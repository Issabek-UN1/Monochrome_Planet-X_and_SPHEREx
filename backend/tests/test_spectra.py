import asyncio
import io
from functools import partial

import httpx
import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS
from fastapi.testclient import TestClient

from spherex.api import create_app
from spherex.errors import ArchiveError
from spherex.models import JobRequest
from spherex.providers.cube import CubeReader, cube_url
from spherex.spectra import cube_pixel, extract_spectrum
from spherex.worker import run_once


@pytest.fixture
def cube_bytes():
    wcs = WCS(naxis=3)
    wcs.wcs.crpix = [2, 2, 1]
    wcs.wcs.crval = [10, 20, 1]
    wcs.wcs.cdelt = [-0.01, 0.01, 0.01]
    wcs.wcs.ctype = ["RA---TAN", "DEC--TAN", "WAVE"]
    wcs.wcs.cunit = ["deg", "deg", "um"]
    header = wcs.to_header()
    header["BUNIT"] = "MJy/sr"
    image = np.broadcast_to(np.arange(102, dtype="f4")[:, None, None], (102, 3, 3)).copy()
    image[50] = np.nan
    image[10] = -3
    hits = np.ones((102, 3, 3), dtype="i4") * 5
    hits[51] = 0
    flags = np.zeros((102, 3, 3), dtype="u4")
    flags[0] = 1 << 21
    flags[1] = 1
    flags[2] = 1 << 31
    channels = fits.BinTableHDU.from_columns(
        [
            fits.Column(name="DETECTOR", format="I", array=np.repeat(np.arange(1, 7), 17)),
            fits.Column(name="SUBCHAN", format="I", array=np.tile(np.arange(1, 18), 6)),
            fits.Column(
                name="WAVELENGTH",
                format="E",
                unit="um",
                array=0.75 + (np.arange(102) / 101) ** 2 * 4.25,
            ),
        ],
        name="SPECTRAL_CHANNELS",
    )
    hdus = fits.HDUList(
        [
            fits.PrimaryHDU(),
            fits.ImageHDU(image, header, name="IMAGE"),
            fits.ImageHDU(hits, name="NHITS"),
            fits.ImageHDU(flags, name="FLAGS"),
            channels,
        ]
    )
    output = io.BytesIO()
    hdus.writeto(output)
    return output.getvalue()


def range_handler(body, calls):
    def handle(request):
        lo, hi = map(int, request.headers["range"].removeprefix("bytes=").split("-"))
        hi = min(hi, len(body) - 1)
        calls.append((lo, hi))
        return httpx.Response(
            206,
            content=body[lo : hi + 1],
            headers={"Content-Range": f"bytes {lo}-{hi}/{len(body)}", "ETag": '"stable"'},
        )

    return handle


async def test_range_extraction_matches_native_cube_and_quality(tmp_path, settings, cube_bytes):
    native = tmp_path / "native.fits"
    native.write_bytes(cube_bytes)
    partial_file = tmp_path / "partial.fits"
    request = JobRequest(kind="spectrum", observation_ids=[], ra=10, dec=20)
    calls = []
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(range_handler(cube_bytes, calls))
    ) as client:
        reader = CubeReader(cube_url(10, 20), client, settings)
        await reader.prepare(partial_file)
        x, y = cube_pixel(partial_file, request)
        await reader.fill_pixel(partial_file, x, y)
    result = extract_spectrum(partial_file, request, cube_url(10, 20))
    assert result == extract_spectrum(native, request, cube_url(10, 20))
    assert len(result.samples) == 102
    assert result.samples[0].usable  # informational source mask retained
    assert result.samples[1].exclusion_reason == "quality_flags"
    assert result.samples[2].flags == 1 << 31  # unsigned BZERO scaling
    assert result.samples[10].surface_brightness_mjy_sr == -3
    assert result.samples[50].surface_brightness_mjy_sr is None
    assert result.samples[51].exclusion_reason == "no_coverage"
    assert all(s.uncertainty_mjy_sr is None for s in result.samples)
    assert result.samples[40].wavelength_um == pytest.approx(0.75 + (40 / 101) ** 2 * 4.25)
    assert len(calls) < 320


async def test_cube_server_cannot_ignore_range(settings):
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200))) as c:
        with pytest.raises(ArchiveError, match="byte ranges"):
            await CubeReader(cube_url(10, 20), c, settings).read(0, 11520)


def test_official_healpix_example():
    assert cube_url(60.8109955, 51.3404038).endswith("/Norder5/Dir0/Npix445_cube.fits")


def test_spectrum_api_worker_and_artifacts(settings, cube_bytes, monkeypatch):
    settings.provider = "irsa"
    monkeypatch.setattr(
        "spherex.spectra.httpx.AsyncClient",
        partial(httpx.AsyncClient, transport=httpx.MockTransport(range_handler(cube_bytes, []))),
    )
    app = create_app(settings)
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/jobs",
            json={
                "kind": "spectrum",
                "observation_ids": [],
                "ra": 10,
                "dec": 20,
                "subtract_zodi": False,
            },
        )
        assert response.status_code == 202, response.text
        job_id = response.json()["id"]
        url = f"/api/v1/jobs/{job_id}/spectrum"
        assert client.get(url).status_code == 404
        asyncio.run(run_once(app.state.store, settings))
        result = client.get(url)
        assert result.status_code == 200, client.get(f"/api/v1/jobs/{job_id}").text
        assert len(result.json()["samples"]) == 102
        assert not result.json()["synthetic"]
        for artifact in client.get(f"/api/v1/jobs/{job_id}").json()["artifacts"]:
            assert client.get(artifact["url"]).status_code == 200
        assert not list(settings.data_dir.rglob("source-cube.fits"))


def test_spectrum_never_falls_back_to_demo(client):
    result = client.post(
        "/api/v1/jobs", json={"kind": "spectrum", "observation_ids": [], "ra": 10, "dec": 20}
    )
    assert result.status_code == 422
    assert "irsa" in result.json()["error"]["message"]


@pytest.mark.parametrize("content_range", ["bytes 1-4/32", "bytes 0-3/999999999"])
async def test_invalid_or_oversized_range_is_rejected(settings, content_range):
    transport = httpx.MockTransport(
        lambda r: httpx.Response(206, content=b"data", headers={"Content-Range": content_range})
    )
    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(ArchiveError, match="byte range"):
            await CubeReader(cube_url(10, 20), client, settings).read(0, 4)


async def test_changed_cube_version_is_rejected(settings):
    calls = []

    def handle(request):
        if calls:
            assert request.headers["If-Match"] == '"stable"'
        calls.append(request)
        return httpx.Response(
            206,
            content=b"data",
            headers={
                "Content-Range": "bytes 0-3/32",
                "ETag": '"stable"' if len(calls) == 1 else '"changed"',
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
        reader = CubeReader(cube_url(10, 20), client, settings)
        await reader.read(0, 4)
        with pytest.raises(ArchiveError, match="version changed"):
            await reader.read(0, 4)
