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
    job = store.claim(owner, settings.lease_seconds)
    if job is None:
        return False

    async def renew():
        while True:
            await asyncio.sleep(settings.lease_seconds / 3)
            await asyncio.to_thread(store.heartbeat, job.id, owner, settings.lease_seconds)

    heartbeat = asyncio.create_task(renew())
    try:
        selected = (
            NEOSSatProvider(settings)
            if job.request.source == "neossat"
            else provider or make_provider(settings)
        )
        if job.request.kind == JobKind.spectrum:
            artifacts, warnings = await process_spectrum(job, store, settings)
        else:
            artifacts, warnings = await process_job(job, store, selected, settings.provider)
        store.finish(job.id, owner, artifacts, warnings)
        logger.info("Job %s succeeded", job.id)
    except Exception as exc:
        logger.exception("Job %s failed", job.id)
        message = (
            str(exc)
            if isinstance(exc, (ValueError, ArchiveError))
            else ("Image processing failed; inspect worker logs and the source FITS product")
        )
        store.finish(job.id, owner, [], [], error=message)
    finally:
        heartbeat.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await heartbeat
    return True


async def serve():
    settings = Settings()
    store = Store(settings.data_dir)
    provider = make_provider(settings)
    logger.info("Worker started; provider=%s data=%s", settings.provider, store.root)
    while True:
        if not await run_once(store, settings, provider):
            await asyncio.sleep(1)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        asyncio.run(serve())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
