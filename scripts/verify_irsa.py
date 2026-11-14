"""Optional network smoke test: a small live search and one real IRSA cutout.

Run `uv run python scripts/verify_irsa.py`. Not part of offline CI.
"""

import asyncio
import io

import numpy as np
from astropy.io import fits

from spherex.config import Settings
from spherex.errors import ArchiveError
from spherex.models import JobRequest, SkySearch
from spherex.providers.irsa import IRSAProvider
from spherex.science import align_fits


async def main():
    provider = IRSAProvider(Settings(provider="irsa"))
    result = await provider.search(SkySearch(ra=127.69444, dec=-39.17760, limit=5))
    print(f"IRSA returned {len(result.observations)} records")
    if not result.observations:
        raise RuntimeError("No records for the test position in the configured collections")
    for observation in result.observations:
        request = JobRequest(
            kind="cutout",
            observation_ids=[observation.id],
            ra=127.69444,
            dec=-39.17760,
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
        try:
            frame = align_fits(body, request)
        except ValueError as exc:
            print(f"Trying another footprint: {exc}")
            continue
        print(f"Aligned {frame.image.shape}; valid pixels: {np.isfinite(frame.image).sum()}")
        return
    raise RuntimeError("None of the sampled observations produced usable pixels")


if __name__ == "__main__":
    asyncio.run(main())
