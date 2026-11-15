import asyncio
import contextlib
import logging
from uuid import uuid4

from spherex.config import Settings
from spherex.errors import ArchiveError
from spherex.models import JobKind
from spherex.processing import process_job
from spherex.providers import make_provider
from spherex.providers.neossat import NEOSSatProvider
from spherex.spectra import process_spectrum
from spherex.storage import Store

logger = logging.getLogger(__name__)


async def run_once(store: Store, settings: Settings, provider=None) -> bool:
    owner = uuid4().hex
    job = await asyncio.to_thread(store.claim, owner, settings.lease_seconds)
    if job is None:
        return False

    async def renew():
        while True:
            await asyncio.sleep(min(settings.lease_seconds / 3, 10))
            if not await asyncio.to_thread(store.heartbeat, job.id, owner, settings.lease_seconds):
                return  # Ownership was lost; processing must stop without publishing output.

    heartbeat = asyncio.create_task(renew())
    processing = None
    try:
        selected = (
            NEOSSatProvider(settings)
            if job.request.source == "neossat"
            else provider or make_provider(settings)
        )
        processing = asyncio.create_task(
            process_spectrum(job, store, settings)
            if job.request.kind == JobKind.spectrum
            else process_job(job, store, selected, settings.provider)
        )
        done, _ = await asyncio.wait(
            {processing, heartbeat},
            timeout=settings.job_timeout_seconds,
            return_when=asyncio.FIRST_COMPLETED,
        )
        if heartbeat in done:
            await heartbeat  # Also propagate database/heartbeat errors.
            logger.warning("Job %s lost its lease; stopping this attempt", job.id)
            return True
        if processing not in done:
            raise TimeoutError("Processing deadline exceeded")
        artifacts, warnings = await processing
        if await asyncio.to_thread(store.finish, job.id, owner, artifacts, warnings):
            logger.info("Job %s succeeded", job.id)
        else:
            logger.warning("Job %s result discarded: lease expired or ownership changed", job.id)
    except asyncio.CancelledError:
        await asyncio.to_thread(store.release, job.id, owner)
        raise
    except Exception as exc:
        logger.exception("Job %s failed", job.id)
        if isinstance(exc, (ValueError, ArchiveError)):
            message = str(exc)
        elif isinstance(exc, TimeoutError):
            message = "Processing deadline exceeded. Retry with fewer frames or a smaller field."
        else:
            message = "Image processing failed; inspect worker logs and the source FITS product"
        await asyncio.to_thread(store.finish, job.id, owner, [], [], error=message)
    finally:
        heartbeat.cancel()
        if processing is not None:
            processing.cancel()
        await asyncio.gather(
            heartbeat, *([processing] if processing else []), return_exceptions=True
        )
    return True


async def serve(settings: Settings | None = None, provider=None):
    settings = settings or Settings()
    store = Store(settings.data_dir)
    provider = provider or make_provider(settings)
    worker_id = uuid4().hex
    logger.info("Worker started; provider=%s data=%s", settings.provider, store.root)
    await asyncio.to_thread(store.worker_ping, worker_id, settings.queue_namespace)

    async def announce():
        while True:
            await asyncio.sleep(5)
            await asyncio.to_thread(store.worker_ping, worker_id, settings.queue_namespace)

    presence = asyncio.create_task(announce())
    work = None
    try:
        while True:
            work = asyncio.create_task(run_once(store, settings, provider))
            done, _ = await asyncio.wait({work, presence}, return_when=asyncio.FIRST_COMPLETED)
            if presence in done:
                await presence
            if not await work:
                await asyncio.sleep(1)
    finally:
        presence.cancel()
        if work is not None:
            work.cancel()
        await asyncio.gather(presence, *([work] if work else []), return_exceptions=True)
        with contextlib.suppress(Exception):
            await asyncio.to_thread(store.worker_remove, worker_id)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        asyncio.run(serve())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
