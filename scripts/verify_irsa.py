"""Optional network smoke test: a small live search and one real IRSA cutout.

Run `uv run python scripts/verify_irsa.py`. Not part of offline CI.
"""

import argparse
import asyncio
import io

import numpy as np
from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.wcs import WCS

from spherex.config import Settings
from spherex.errors import ArchiveError
from spherex.models import JobRequest, SkySearch
from spherex.providers.irsa import IRSAProvider
from spherex.science import align_fits
from spherex.targets import TARGETS


async def main(target_id: str, detector: int | None):
    target = next(t for t in TARGETS if t.id == target_id)
    provider = IRSAProvider(Settings(provider="irsa"))
    result = await provider.search(
        SkySearch(ra=target.ra, dec=target.dec, radius_deg=0.001, detector=detector, limit=5)
    )
    print(f"Field: {target.name}; detector: {detector or 'all'}")
    print(f"IRSA returned {len(result.observations)} records")
    if not result.observations:
        raise RuntimeError("No records for the test position in the configured collections")
    for observation in result.observations:
        request = JobRequest(
            kind="cutout",
            observation_ids=[observation.id],
            ra=target.ra,
            dec=target.dec,
            fov_deg=0.025,
            size_px=64,
        )
        try:
            body = await provider.fetch(observation, request)
        except ArchiveError as exc:
            print(f"Cutout unavailable for {observation.obs_id}: {exc}")
            continue
        with fits.open(io.BytesIO(body), memmap=False) as hdus:
            print(f"FITS {len(body)} bytes; HDUs: {[h.name for h in hdus]}")
            required = {"IMAGE", "FLAGS", "VARIANCE", "ZODI", "EPSF", "WCS-WAVE"}
            if not required.issubset(h.name for h in hdus):
                raise RuntimeError("Archive cutout is missing expected SPHEREx MEF extensions")
            spatial = WCS(hdus["IMAGE"].header, fobj=hdus).celestial
            x, y = spatial.world_to_pixel(SkyCoord(target.ra, target.dec, unit="deg", frame="icrs"))
            spectral = WCS(hdus["IMAGE"].header, fobj=hdus, key="W")
            # SIP describes optical sky distortion, not the detector-filter wavelength lookup.
            spectral.sip = None
            wavelength, bandwidth = spectral.pixel_to_world(x, y)
            values = [wavelength.to_value(u.um), bandwidth.to_value(u.um)]
            if not np.all(np.isfinite(values)) or min(values) <= 0:
                raise RuntimeError("No valid spectral WCS calibration at the field centre")
            print(
                f"Approximate centre wavelength: {values[0]:.5f} um; bandwidth: {values[1]:.5f} um"
            )
            print(f"Pipeline VERSION: {hdus[0].header.get('VERSION', 'not supplied')}")
        try:
            frame = align_fits(body, request)
        except ValueError as exc:
            print(f"Trying another footprint: {exc}")
            continue
        print(f"Aligned {frame.image.shape}; valid pixels: {np.isfinite(frame.image).sum()}")
        return
    raise RuntimeError("None of the sampled observations produced usable pixels")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", choices=[t.id for t in TARGETS], default="wise-0855")
    parser.add_argument("--detector", type=int, choices=range(1, 7))
    args = parser.parse_args()
    asyncio.run(main(args.target, args.detector))
