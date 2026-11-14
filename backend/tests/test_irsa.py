from functools import partial

import httpx
import pytest

from spherex.errors import ArchiveError
from spherex.models import SkySearch
from spherex.providers.irsa import IRSAProvider, parse_csv, validate_data_url

URL = (
    "https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/"
    "example/level2_example_1D2_spx_l2b.fits"
)
CSV = (
    "obs_id,access_url,obs_collection,s_ra,s_dec,t_min,t_max,em_min,em_max\n"
    f"obs-1,{URL},spherex_dr1,10,20,61000,61001,1.1e-6,1.62e-6\n"
).encode()


def test_sia_csv_normalization():
    result = parse_csv(CSV, SkySearch(ra=10, dec=20), ["spherex_dr1"])
    obs = result.observations[0]
    assert obs.detector == 2
    assert obs.wavelength_min_um == pytest.approx(1.1)
    assert obs.mjd_start == 61000
    assert not obs.synthetic
    with pytest.raises(ArchiveError):
        parse_csv(b"<VOTABLE>error</VOTABLE>", result.query, ["spherex_dr1"])


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/private.fits",
        "https://irsa.ipac.caltech.edu.evil.org/file.fits",
        "https://irsa.ipac.caltech.edu/ibe/data/spherex/%2e%2e/private.fits",
        URL + "?url=https://evil.org",
        URL.replace("https", "http"),
        "https://user@irsa.ipac.caltech.edu/ibe/data/spherex/a.fits",
    ],
)
def test_download_url_allowlist(url):
    with pytest.raises(ArchiveError):
        validate_data_url(url)


async def test_sia_parameters_and_bounded_download(settings, monkeypatch):
    def handle(request):
        assert request.url.params.get_list("COLLECTION") == ["spherex_dr1", "spherex_qr3"]
        assert request.url.params["BAND"] == "1e-06 2e-06"
        assert request.url.params["TIME"] == "61000.0 +Inf"
        return httpx.Response(200, content=CSV)

    monkeypatch.setattr(
        "spherex.providers.irsa.httpx.AsyncClient",
        partial(httpx.AsyncClient, transport=httpx.MockTransport(handle)),
    )
    provider = IRSAProvider(settings)
    result = await provider.search(
        SkySearch(ra=10, dec=20, mjd_min=61000, wavelength_min_um=1, wavelength_max_um=2)
    )
    assert len(result.observations) == 1
    with pytest.raises(ArchiveError, match="size limit"):
        await provider._get(
            "https://irsa.ipac.caltech.edu/SIA",
            [
                ("COLLECTION", "spherex_dr1"),
                ("COLLECTION", "spherex_qr3"),
                ("BAND", "1e-06 2e-06"),
                ("TIME", "61000.0 +Inf"),
            ],
            10,
        )


async def test_irsa_retries_transient_failure_once(settings, monkeypatch):
    calls = []

    def handle(request):
        calls.append(request)
        return httpx.Response(503 if len(calls) == 1 else 200, content=CSV)

    monkeypatch.setattr(
        "spherex.providers.irsa.httpx.AsyncClient",
        partial(httpx.AsyncClient, transport=httpx.MockTransport(handle)),
    )
    result = await IRSAProvider(settings).search(SkySearch(ra=10, dec=20))
    assert len(calls) == 2
    assert len(result.observations) == 1


async def test_irsa_does_not_retry_invalid_request(settings, monkeypatch):
    calls = []

    def handle(request):
        calls.append(request)
        return httpx.Response(400)

    monkeypatch.setattr(
        "spherex.providers.irsa.httpx.AsyncClient",
        partial(httpx.AsyncClient, transport=httpx.MockTransport(handle)),
    )
    with pytest.raises(ArchiveError):
        await IRSAProvider(settings).search(SkySearch(ra=10, dec=20))
    assert len(calls) == 1
