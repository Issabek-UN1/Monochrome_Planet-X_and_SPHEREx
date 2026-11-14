import asyncio
import io
import json

import pytest
from astropy.io import fits

from spherex.api import create_app
from spherex.errors import ArchiveError
from spherex.worker import run_once


@pytest.mark.parametrize(
    "params",
    [
        {"ra": 360, "dec": 0},
        {"ra": 0, "dec": -91},
        {"ra": "nan", "dec": 0},
        {"ra": 0, "dec": 0, "limit": 501},
        {"ra": 0, "dec": 0, "radius_deg": 0},
        {"ra": 0, "dec": 0, "mjd_min": 20, "mjd_max": 10},
    ],
)
def test_search_rejects_invalid_inputs(client, params):
    result = client.get("/api/v1/observations", params=params)
    assert result.status_code == 422
    assert result.json()["error"]["request_id"] == result.headers["X-Request-ID"]


def test_search_cached_and_labelled(client):
    first = client.get("/api/v1/observations?ra=10&dec=20").json()
    second = client.get("/api/v1/observations?ra=10&dec=20").json()
    assert not first["cached"] and second["cached"]
    assert len(first["observations"]) == 24
    assert all(o["synthetic"] for o in first["observations"])
    assert first["warnings"]
    assert client.get("/api/v1/capabilities").json()["synthetic"]


def test_demo_filters(client):
    result = client.get(
        "/api/v1/observations",
        params={
            "ra": 10,
            "dec": 20,
            "mjd_min": 61050,
            "mjd_max": 61100,
            "wavelength_min_um": 0.8,
            "wavelength_max_um": 1,
        },
    ).json()
    assert len(result["observations"]) == 1
    assert result["observations"][0]["detector"] == 1


def test_unknown_observation_and_mixed_detectors(client, observations):
    base = {"kind": "cutout", "observation_ids": ["0" * 24], "ra": 10, "dec": 20}
    assert client.post("/api/v1/jobs", json=base).status_code == 422
    base.update(kind="difference", observation_ids=[o["id"] for o in observations[:2]])
    assert client.post("/api/v1/jobs", json=base).status_code == 422
    assert client.get("/api/v1/jobs/" + "0" * 32).status_code == 404


@pytest.mark.parametrize("kind", ["cutout", "stack", "difference", "blink"])
def test_full_pipeline(client, app, settings, observations, kind):
    selected = [o["id"] for o in observations if o["detector"] == 1]
    result = client.post(
        "/api/v1/jobs",
        json={
            "kind": kind,
            "observation_ids": selected[: 1 if kind == "cutout" else 2],
            "ra": 10,
            "dec": 20,
            "size_px": 64,
        },
    )
    assert result.status_code == 202
    assert result.headers["Location"].endswith(result.json()["id"])
    assert asyncio.run(run_once(app.state.store, settings))
    job = client.get(result.headers["Location"]).json()
    assert job["status"] == "succeeded", job
    for artifact in job["artifacts"]:
        response = client.get(artifact["url"])
        assert response.status_code == 200
        if artifact["name"].endswith(".fits"):
            with fits.open(io.BytesIO(response.content), checksum=True) as hdus:
                assert hdus["IMAGE"].data.shape == (64, 64)
                assert hdus["IMAGE"].header["SYNTHET"]
        if artifact["name"] == "provenance.json":
            provenance = json.loads(response.content)
            assert provenance["synthetic"]
            assert provenance["warnings"]
    assert client.get(f"/api/v1/jobs/{job['id']}/artifacts/spherex.sqlite3").status_code == 404


def test_queue_capacity(client, settings, observations):
    settings.max_pending_jobs = 1
    request = {"kind": "cutout", "observation_ids": [observations[0]["id"]], "ra": 10, "dec": 20}
    assert client.post("/api/v1/jobs", json=request).status_code == 202
    result = client.post("/api/v1/jobs", json=request)
    assert result.status_code == 429
    assert result.headers["Retry-After"] == "30"


def test_cors(client):
    allowed = client.get("/health/live", headers={"Origin": "http://localhost:5173"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    denied = client.get("/health/live", headers={"Origin": "https://untrusted.example"})
    assert "access-control-allow-origin" not in denied.headers


def test_unknown_route_uses_error_envelope(client):
    response = client.get("/api/v1/unknown")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "request_error"


def test_archive_failure_is_explicit(settings):
    from fastapi.testclient import TestClient

    class Broken:
        async def search(self, query):
            raise ArchiveError("IRSA unavailable")

    with TestClient(create_app(settings, provider=Broken())) as client:
        result = client.get("/api/v1/observations?ra=10&dec=20")
        assert result.status_code == 502
        assert result.json()["error"]["code"] == "archive_error"
