"""Measured mosaic-pixel spectra, separate from HTTP and archive transport."""

import asyncio
import csv
from pathlib import Path

import httpx
import numpy as np
from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.wcs import WCS

from spherex.config import Settings
from spherex.errors import ArchiveError
from spherex.models import Artifact, Job, JobRequest, SpectrumResult, SpectrumSample
from spherex.providers.cube import CUBE_RELEASE, CubeReader, cube_url
from spherex.storage import Store

WARNINGS = [
    "Measured DR1 mosaic-pixel surface brightness; not source flux or atmospheric classification.",
    "102 nominal layers; blank, missing and rejected channels stay missing without interpolation.",
    "The cube provides no variance: uncertainties are unavailable, not zero.",
    "Zodiacal light is already subtracted. No additional ZODI subtraction is applied.",
    "Mosaic striping, PSF changes, blends and proper motion can affect this fixed sky pixel. "
    "Use the IRSA Spectrophotometry Tool for research-ready source measurements.",
]


def cube_pixel(path: Path, request: JobRequest):
    with fits.open(path, memmap=True, do_not_scale_image_data=True) as hdus:
        sky = WCS(hdus["IMAGE"].header, fobj=hdus).celestial
        px, py = sky.world_to_pixel(SkyCoord(request.ra, request.dec, unit="deg", frame="icrs"))
        if not np.all(np.isfinite([px, py])):
            raise ValueError("Coordinate has no finite cube pixel")
        return int(np.floor(px + 0.5)), int(np.floor(py + 0.5))


def extract_spectrum(path: Path, request: JobRequest, source_url: str) -> SpectrumResult:
    # Only copy 102-value columns from memmapped images, never the entire cube.
    with fits.open(path, memmap=True, do_not_scale_image_data=True) as hdus:
        image = hdus["IMAGE"]
        if len(image.shape) != 3 or image.shape[0] != 102:
            raise ValueError("Expected a 102-layer DR1 cube")
        for name in ("NHITS", "FLAGS"):
            if hdus[name].shape != image.shape:
                raise ValueError("Cube quality planes do not match IMAGE")
        sky = WCS(image.header, fobj=hdus).celestial
        px, py = sky.world_to_pixel(SkyCoord(request.ra, request.dec, unit="deg", frame="icrs"))
        if not np.all(np.isfinite([px, py])):
            raise ValueError("Coordinate has no finite cube pixel")
        x, y = int(np.floor(px + 0.5)), int(np.floor(py + 0.5))
        if not (0 <= x < image.shape[2] and 0 <= y < image.shape[1]):
            raise ValueError("Coordinate falls outside the selected cube tile")
        sampled = sky.pixel_to_world(x, y).icrs
        table = hdus["SPECTRAL_CHANNELS"]
        if len(table.data) != 102:
            raise ValueError("Missing calibrated 102-channel wavelength table")
        wavelengths = (
            table.data["WAVELENGTH"] * u.Unit(table.columns["WAVELENGTH"].unit)
        ).to_value(u.um)
        if not np.all(np.isfinite(wavelengths)) or np.any(wavelengths <= 0):
            raise ValueError("Invalid cube wavelengths")
        factor = u.Unit(image.header.get("BUNIT", "")).to(u.MJy / u.sr)

        def column(name):
            hdu = hdus[name]
            raw = np.array(hdu.section[:, y, x], dtype=np.float64)
            blank = hdu.header.get("BLANK")
            if blank is not None:
                raw[raw == blank] = np.nan
            return raw * hdu.header.get("BSCALE", 1) + hdu.header.get("BZERO", 0)

        values = column("IMAGE") * factor
        hits, flags = column("NHITS"), column("FLAGS")
        samples = []
        for index in range(102):
            value, hit, flag = values[index], hits[index], flags[index]
            count = max(0, int(hit)) if np.isfinite(hit) else 0
            bits = int(flag) & 0xFFFFFFFF if np.isfinite(flag) else 0xFFFFFFFF
            reason = (
                "no_coverage"
                if not count or not np.isfinite(value)
                else ("quality_flags" if bits & request.reject_flags else None)
            )
            samples.append(
                SpectrumSample(
                    channel=index + 1,
                    detector=int(table.data["DETECTOR"][index]),
                    subchannel=int(table.data["SUBCHAN"][index]),
                    wavelength_um=float(wavelengths[index]),
                    surface_brightness_mjy_sr=float(value)
                    if np.isfinite(value) and count
                    else None,
                    nhits=count,
                    flags=bits,
                    usable=reason is None,
                    exclusion_reason=reason,
                )
            )
        return SpectrumResult(
            ra=request.ra,
            dec=request.dec,
            sampled_ra=float(sampled.ra.deg) % 360,
            sampled_dec=float(sampled.dec.deg),
            source_url=source_url,
            release=CUBE_RELEASE,
            reject_flags=request.reject_flags,
            samples=samples,
            warnings=WARNINGS,
        )


def write_spectrum(result: SpectrumResult, job: Job, output: Path):
    (output / "spectrum.json").write_text(result.model_dump_json(indent=2), encoding="utf-8")
    with (output / "spectrum.csv").open("w", newline="", encoding="utf-8") as file:
        rows = [sample.model_dump() for sample in result.samples]
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    (output / "provenance.json").write_text(
        result.model_dump_json(indent=2, exclude={"samples"}), encoding="utf-8"
    )
    return [
        Artifact(name=name, media_type=media, url=f"/api/v1/jobs/{job.id}/artifacts/{name}")
        for name, media in [
            ("spectrum.json", "application/json"),
            ("spectrum.csv", "text/csv"),
            ("provenance.json", "application/json"),
        ]
    ], result.warnings


async def process_spectrum(job: Job, store: Store, settings: Settings):
    if settings.provider != "irsa":
        raise ValueError("Real DR1 cube spectra require SPHEREX_PROVIDER=irsa")
    output = store.root / "artifacts" / job.id / str(job.attempts)
    output.mkdir(parents=True, exist_ok=True)
    temporary = output / "source-cube.fits"
    url = cube_url(job.request.ra, job.request.dec)
    try:
        async with (
            asyncio.timeout(300),
            httpx.AsyncClient(
                timeout=settings.http_timeout_seconds,
                follow_redirects=False,
            ) as client,
        ):
            reader = CubeReader(url, client, settings)
            await reader.prepare(temporary)
            x, y = await asyncio.to_thread(cube_pixel, temporary, job.request)
            await reader.fill_pixel(temporary, x, y)
        result = await asyncio.to_thread(extract_spectrum, temporary, job.request, url)
        result.source_etag = reader.etag
        result.downloaded_bytes = reader.bytes_received
        return await asyncio.to_thread(write_spectrum, result, job, output)
    except TimeoutError as exc:
        raise ArchiveError("IRSA spectrum extraction timed out; retry later") from exc
    finally:
        temporary.unlink(missing_ok=True)
