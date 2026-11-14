import asyncio
import io
from functools import partial

import httpx
import numpy as np
import pytest
from astropy.io import fits

from spherex.errors import ArchiveError
from spherex.models import JobRequest, Observation, SearchResult, SkySearch
from spherex.neossat_science import align_neossat
from spherex.providers.neossat import NEOSSatProvider, validate_url
from spherex.science import fits_bytes, target_wcs
from spherex.worker import run_once


def primary(req):
    header = target_wcs(req).to_header()
    header["BUNIT"] = "adu"
    data = np.arange(req.size_px**2, dtype=float).reshape(req.size_px, req.size_px)
    buffer = io.BytesIO()
    fits.PrimaryHDU(data, header).writeto(buffer)
    return buffer.getvalue()


def test_neossat_retains_counts_without_invented_variance():
    req = JobRequest(
        source="neossat",
        kind="cutout",
        observation_ids=["a" * 24],
        ra=10,
        dec=20,
        size_px=32,
        subtract_zodi=False,
        reject_flags=0,
    )
    frame = align_neossat(primary(req), req)
    assert frame.unit == "adu"
    with fits.open(io.BytesIO(fits_bytes(frame, False))) as hdus:
        assert hdus["IMAGE"].header["BUNIT"] == "adu"
        assert "VARIANCE" not in hdus and "FLAGS" not in hdus
        assert np.nanmax(hdus["IMAGE"].data) == 1023


@pytest.mark.parametrize(
    "url",
    [
        "https://evil.org/file.fits",
        "http://cadc-west-01.canfar.net/raven/files/cadc:NEOSSAT/a.fits",
        "https://cadc-west-01.canfar.net/raven/files/cadc:OTHER/a.fits",
        "https://cadc-west-01.canfar.net/raven/files/cadc:NEOSSAT/../a.fits",
    ],
)
def test_neossat_url_allowlist(url):
    with pytest.raises(ArchiveError):
        validate_url(url)


async def test_neossat_query_parameters(settings, monkeypatch):
    def handle(request):
        query = request.url.params["QUERY"]
        assert "obs_collection='NEOSSAT'" in query and "calib_level>=2" in query
        assert "t_max>=60900" in query
        return httpx.Response(
            200,
            text="obs_id,access_url,obs_publisher_did,s_ra,s_dec,t_min\n"
            "obs,,ivo://cadc.nrc.ca/NEOSSAT?2025225115154/cord,10,20,60900\n",
        )

    monkeypatch.setattr(
        "spherex.providers.neossat.httpx.AsyncClient",
        partial(httpx.AsyncClient, transport=httpx.MockTransport(handle)),
    )
    result = await NEOSSatProvider(settings).search(
        SkySearch(source="neossat", ra=10, dec=20, mjd_min=60900)
    )
    assert result.observations[0].provider == "neossat"
    assert result.observations[0].access_url is None


async def test_neossat_redirects_and_response_limit(settings, monkeypatch):
    first = "https://cadc-west-01.canfar.net/raven/files/cadc:NEOSSAT/a.fits"
    final = "https://ws-uv.canfar.net/minoc/files/public/cadc:NEOSSAT/a.fits"

    def handle(request):
        if str(request.url) == first:
            return httpx.Response(303, headers={"Location": final})
        return httpx.Response(200, content=b"test-fits")

    monkeypatch.setattr(
        "spherex.providers.neossat.httpx.AsyncClient",
        partial(httpx.AsyncClient, transport=httpx.MockTransport(handle)),
    )
    provider = NEOSSatProvider(settings)
    assert await provider._get(first) == b"test-fits"
    with pytest.raises(ArchiveError, match="size limit"):
        await provider._get(first, limit=3)
    with pytest.raises(ArchiveError):
        validate_url("https://evil.org/minoc/files/public/cadc:NEOSSAT/a.fits", redirect=True)


def test_neossat_api_and_worker(client, app, settings, monkeypatch):
    obs = Observation(
        id="a" * 24,
        provider="neossat",
        collection="NEOSSAT",
        obs_id="ivo://cadc.nrc.ca/NEOSSAT?2025225115154/cord",
        synthetic=True,
    )

    class Fake:
        async def search(self, query):
            return SearchResult(query=query, observations=[obs], possibly_truncated=False)

        async def fetch(self, observation, request):
            return primary(request)

    app.state.neossat = Fake()
    monkeypatch.setattr("spherex.worker.NEOSSatProvider", lambda _: Fake())
    response = client.get("/api/v1/observations?source=neossat&ra=10&dec=20")
    assert response.status_code == 200
    assert response.json()["observations"][0]["provider"] == "neossat"
    body = {
        "source": "neossat",
        "kind": "cutout",
        "observation_ids": [obs.id],
        "ra": 10,
        "dec": 20,
        "size_px": 32,
    }
    assert client.post("/api/v1/jobs", json=body).status_code == 422
    body.update(subtract_zodi=False, reject_flags=0)
    response = client.post("/api/v1/jobs", json=body)
    assert response.status_code == 202
    assert asyncio.run(run_once(app.state.store, settings))
    job = client.get(response.headers["Location"]).json()
    assert job["status"] == "succeeded", job
    provenance = next(a for a in job["artifacts"] if a["name"] == "provenance.json")
    metadata = client.get(provenance["url"]).json()
    assert metadata["units"] == {"image": "adu", "variance": None}
    # Selecting a NEOSSat ID under the SPHEREx source must never succeed.
    body["source"] = "spherex"
    assert client.post("/api/v1/jobs", json=body).status_code == 422
