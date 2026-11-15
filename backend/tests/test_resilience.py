import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from email.utils import format_datetime
from functools import partial
from unittest.mock import AsyncMock

import httpx
import pytest

from spherex.errors import ArchiveError
from spherex.models import Artifact, JobRequest, SkySearch
from spherex.providers.cube import CubeReader, cube_url
from spherex.providers.http import retry_after, retry_delay
from spherex.providers.irsa import IRSAProvider, parse_csv
from spherex.providers.neossat import TAP, NEOSSatProvider
from spherex.storage import Store
from spherex.worker import run_once, serve


def request(ra=10):
    return JobRequest(kind="cutout", observation_ids=["a" * 24], ra=ra, dec=20)


def test_concurrent_duplicate_requests_use_one_queue_slot(tmp_path):
    store = Store(tmp_path)
    with ThreadPoolExecutor(max_workers=4) as pool:
        ids = list(pool.map(lambda _: store.enqueue(request(), 1).id, range(4)))
    assert len(set(ids)) == 1
    assert store.claim("worker", 60).id == ids[0]
    assert store.enqueue(request(), 1).id == ids[0]


def test_cache_checks_namespace_ttl_and_artifact_existence(tmp_path):
    store = Store(tmp_path)
    job = store.enqueue(request(), 10, namespace="irsa")
    running = store.claim("worker", 60)
    path = tmp_path / "artifacts" / job.id / str(running.attempts) / "result.png"
    path.parent.mkdir(parents=True)
    path.write_bytes(b"fixture")
    assert store.finish(
        job.id, "worker", [Artifact(name="result.png", media_type="image/png", url="/x")], []
    )
    assert store.enqueue(request(), 10, namespace="irsa", cache_ttl=900).id == job.id
    assert store.enqueue(request(), 10, namespace="demo", cache_ttl=900).id != job.id
    path.unlink()
    fresh = store.enqueue(request(), 10, namespace="irsa", cache_ttl=900)
    assert fresh.id != job.id
    # A failed job must not be reused on retry.
    store.claim("other", 60)  # demo namespace job
    store.finish(store.claim("retry", 60).id, "retry", [], [], error="failed")
    assert store.enqueue(request(), 10, namespace="irsa", cache_ttl=900).id != fresh.id


def test_result_cache_expires(tmp_path):
    store = Store(tmp_path)
    job = store.enqueue(request(), 10)
    running = store.claim("worker", 60)
    path = tmp_path / "artifacts" / job.id / str(running.attempts) / "result.png"
    path.parent.mkdir(parents=True)
    path.write_bytes(b"fixture")
    store.finish(
        job.id, "worker", [Artifact(name="result.png", media_type="image/png", url="/x")], []
    )
    with store.connection() as db:
        db.execute("UPDATE jobs SET updated=?", (time.time() - 1000,))
    assert store.enqueue(request(), 10, cache_ttl=900).id != job.id


def test_version_one_database_preserves_jobs(tmp_path):
    store = Store(tmp_path)
    original = store.enqueue(request(), 10)
    with store.connection() as db:
        db.execute("DROP TABLE workers")
        db.execute("DROP TABLE job_context")
        db.execute("DROP INDEX jobs_request")
        db.execute("PRAGMA user_version=1")
    migrated = Store(tmp_path)
    assert migrated.job(original.id).request == original.request
    assert migrated.claim("worker", 60).id == original.id
    assert migrated.finish(original.id, "worker", [], [], error="fixture")
    with migrated.connection() as db:
        assert db.execute("PRAGMA user_version").fetchone()[0] == 2


def test_expired_worker_cannot_revive_or_publish_attempt(tmp_path):
    store = Store(tmp_path)
    job = store.enqueue(request(), 10)
    store.claim("expired", 60)
    with store.connection() as db:
        db.execute("UPDATE jobs SET lease_until=0")
    assert not store.heartbeat(job.id, "expired", 60)
    assert not store.finish(job.id, "expired", [], [])
    assert store.job(job.id).status == "running"
    assert store.claim("replacement", 60).attempts == 2
    store.release(job.id, "expired")
    assert store.job(job.id).status == "running"
    store.release(job.id, "replacement")
    assert store.job(job.id).status == "queued"


def test_readiness_checks_matching_worker_and_heartbeat(client, settings):
    assert client.get("/health/live").status_code == 200
    assert client.get("/health/ready").status_code == 503
    store = client.app.state.store
    store.worker_ping("wrong", "another configuration")
    assert client.get("/health/ready").status_code == 503
    store.worker_ping("right", settings.queue_namespace)
    assert client.get("/health/ready").status_code == 200
    assert client.get("/health/ready").json()["checks"]["worker"] == "ok"
    with store.connection() as db:
        db.execute("UPDATE workers SET updated=0")
    assert client.get("/health/ready").status_code == 503


async def test_serve_announces_and_removes_worker(settings):
    store = Store(settings.data_dir)
    worker = asyncio.create_task(serve(settings))
    try:
        async with asyncio.timeout(2):
            while not store.worker_available(settings.queue_namespace):
                await asyncio.sleep(0.01)
    finally:
        worker.cancel()
        await asyncio.gather(worker, return_exceptions=True)
    assert not store.worker_available(settings.queue_namespace)


async def test_worker_deadline_frees_queue(settings, client, observations):
    settings.job_timeout_seconds = 0.05

    class Slow:
        async def fetch(self, observation, body):
            await asyncio.sleep(30)

    store = client.app.state.store
    body = JobRequest(kind="cutout", observation_ids=[observations[0]["id"]], ra=10, dec=20)
    job = store.enqueue(body, 10)
    await asyncio.wait_for(run_once(store, settings, Slow()), 2)
    assert store.job(job.id).status == "failed"
    assert "deadline" in store.job(job.id).error
    assert store.enqueue(body, 1).id != job.id


async def test_shutdown_requeues_inflight_job(settings, client, observations):
    started = asyncio.Event()
    interrupted = asyncio.Event()

    class Slow:
        async def fetch(self, observation, body):
            started.set()
            try:
                await asyncio.sleep(30)
            finally:
                interrupted.set()

    store = client.app.state.store
    body = JobRequest(kind="cutout", observation_ids=[observations[0]["id"]], ra=10, dec=20)
    job = store.enqueue(body, 10)
    worker = asyncio.create_task(run_once(store, settings, Slow()))
    await asyncio.wait_for(started.wait(), 2)
    worker.cancel()
    with pytest.raises(asyncio.CancelledError):
        await worker
    assert interrupted.is_set()
    assert store.job(job.id).status == "queued"
    assert store.claim("replacement", 60).attempts == 2


async def test_lease_loss_stops_download(settings, client, observations, monkeypatch):
    # Short lease makes the heartbeat test deterministic without a 10-second sleep.
    settings.lease_seconds = 0.06
    interrupted = asyncio.Event()

    class Slow:
        async def fetch(self, observation, body):
            try:
                await asyncio.sleep(30)
            finally:
                interrupted.set()

    store = client.app.state.store
    body = JobRequest(kind="cutout", observation_ids=[observations[0]["id"]], ra=10, dec=20)
    job = store.enqueue(body, 10)
    monkeypatch.setattr(store, "heartbeat", lambda *args: False)
    await asyncio.wait_for(run_once(store, settings, Slow()), 2)
    assert interrupted.is_set()
    assert store.job(job.id).status == "running"
    assert store.job(job.id).artifacts == []


async def test_irsa_transient_failures_retry_twice_with_server_delay(settings, monkeypatch):
    calls = []
    sleep = AsyncMock()

    def handle(req):
        calls.append(req)
        return httpx.Response(
            503 if len(calls) < 3 else 200, content=b"ok", headers={"Retry-After": "2"}
        )

    monkeypatch.setattr("spherex.providers.irsa.asyncio.sleep", sleep)
    monkeypatch.setattr(
        "spherex.providers.irsa.httpx.AsyncClient",
        partial(httpx.AsyncClient, transport=httpx.MockTransport(handle)),
    )
    assert await IRSAProvider(settings)._get("https://irsa.ipac.caltech.edu/SIA", {}, 100) == b"ok"
    assert [call.args[0] for call in sleep.call_args_list] == [2, 2]


async def test_irsa_long_rate_limit_is_exposed_without_retrying_early(settings, monkeypatch):
    calls = []

    def handle(req):
        calls.append(req)
        return httpx.Response(429, headers={"Retry-After": "120"})

    monkeypatch.setattr(
        "spherex.providers.irsa.httpx.AsyncClient",
        partial(httpx.AsyncClient, transport=httpx.MockTransport(handle)),
    )
    with pytest.raises(ArchiveError, match="HTTP 429") as failure:
        await IRSAProvider(settings).search(SkySearch(ra=10, dec=20))
    assert len(calls) == 1
    assert failure.value.code == "archive_rate_limited"
    assert failure.value.retry_after == 120


async def test_irsa_timeout_has_actionable_context(settings, monkeypatch):
    def handle(req):
        raise httpx.ReadTimeout("fixture", request=req)

    monkeypatch.setattr("spherex.providers.irsa.asyncio.sleep", AsyncMock())
    monkeypatch.setattr(
        "spherex.providers.irsa.httpx.AsyncClient",
        partial(httpx.AsyncClient, transport=httpx.MockTransport(handle)),
    )
    with pytest.raises(ArchiveError, match="cutout observation-1: Request timed out"):
        await IRSAProvider(settings)._get(
            "https://irsa.ipac.caltech.edu/SIA", {}, 100, operation="cutout observation-1"
        )


@pytest.mark.parametrize("raw", ["NaN", "inf", "invalid"])
def test_invalid_retry_after_uses_backoff(raw):
    response = httpx.Response(
        503, headers={"Retry-After": raw}, request=httpx.Request("GET", "https://example.com")
    )
    assert retry_after(response) is None
    assert (
        retry_delay(
            httpx.HTTPStatusError("fixture", request=response.request, response=response), 1
        )
        == 2
    )


def test_retry_after_http_date():
    value = format_datetime(datetime.now(UTC) + timedelta(seconds=120), usegmt=True)
    assert 118 <= retry_after(httpx.Response(429, headers={"Retry-After": value})) <= 120


@pytest.mark.parametrize(
    "row", ["x,", ",https://irsa.ipac.caltech.edu/ibe/data/spherex/a.fits", "x,url,extra"]
)
def test_incomplete_sia_rows_are_archive_errors(row):
    with pytest.raises(ArchiveError):
        parse_csv(
            ("obs_id,access_url\n" + row + "\n").encode(),
            SkySearch(ra=10, dec=20),
            ["spherex_dr1"],
        )


async def test_cube_checks_file_bounds_and_last_modified(settings):
    modified = "Mon, 01 Jan 2024 00:00:00 GMT"
    calls = []

    def handle(req):
        calls.append(req)
        if len(calls) > 1:
            assert req.headers["If-Unmodified-Since"] == modified
        return httpx.Response(
            206,
            content=b"data",
            headers={
                "Content-Range": "bytes 0-3/32",
                "Last-Modified": modified if len(calls) == 1 else "Tue, 02 Jan 2024 00:00:00 GMT",
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
        reader = CubeReader(cube_url(10, 20), client, settings)
        with pytest.raises(ArchiveError):
            await reader.read(-1, 4)
        await reader.read(0, 4)
        with pytest.raises(ArchiveError, match="modification time changed"):
            await reader.read(0, 4)
        with pytest.raises(ArchiveError, match="beyond end"):
            await reader.read(32, 4)


async def test_cadc_retries_transient_failure(settings, monkeypatch):
    calls = []

    def handle(req):
        calls.append(req)
        return httpx.Response(503 if len(calls) < 2 else 200, content=b"ok")

    monkeypatch.setattr("spherex.providers.neossat.asyncio.sleep", AsyncMock())
    monkeypatch.setattr(
        "spherex.providers.neossat.httpx.AsyncClient",
        partial(httpx.AsyncClient, transport=httpx.MockTransport(handle)),
    )
    assert await NEOSSatProvider(settings)._get(TAP) == b"ok"
    assert len(calls) == 2


def test_api_exposes_archive_code_and_retry_after(settings):
    from fastapi.testclient import TestClient

    from spherex.api import create_app

    class Limited:
        async def search(self, query):
            raise ArchiveError(
                "IRSA search: Rate limit (HTTP 429)", code="archive_rate_limited", retry_after=120
            )

    with TestClient(create_app(settings, provider=Limited())) as client:
        response = client.get("/api/v1/observations?ra=10&dec=20")
        assert response.status_code == 502
        assert response.headers["Retry-After"] == "120"
        assert response.json()["error"]["code"] == "archive_rate_limited"
        assert response.json()["error"]["request_id"] == response.headers["X-Request-ID"]


async def test_cube_cannot_report_range_past_total_size(settings):
    def handle(req):
        return httpx.Response(206, content=b"data", headers={"Content-Range": "bytes 0-3/3"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
        with pytest.raises(ArchiveError, match="byte range"):
            await CubeReader(cube_url(10, 20), client, settings).read(0, 4)


async def test_cadc_redirect_without_location_is_archive_error(settings, monkeypatch):
    monkeypatch.setattr(
        "spherex.providers.neossat.httpx.AsyncClient",
        partial(httpx.AsyncClient, transport=httpx.MockTransport(lambda _: httpx.Response(303))),
    )
    with pytest.raises(ArchiveError, match="no destination"):
        await NEOSSatProvider(settings)._get(TAP)
