import hashlib
import io

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS

from spherex.errors import ArchiveError
from spherex.models import JobRequest, Observation, SearchResult, SkySearch


class DemoProvider:
    """Deterministic, labelled synthetic observations, never an IRSA fallback."""

    async def search(self, query: SkySearch) -> SearchResult:
        observations = []
        for epoch in range(4):
            for detector, (lo, hi) in enumerate(
                [
                    (0.75, 1.09),
                    (1.10, 1.62),
                    (1.63, 2.41),
                    (2.42, 3.82),
                    (3.83, 4.41),
                    (4.42, 5.00),
                ],
                1,
            ):
                mjd = 61000.0 + epoch * 90
                if query.mjd_min is not None and mjd < query.mjd_min:
                    continue
                if query.mjd_max is not None and mjd > query.mjd_max:
                    continue
                if query.wavelength_min_um is not None and hi < query.wavelength_min_um:
                    continue
                if query.wavelength_max_um is not None and lo > query.wavelength_max_um:
                    continue
                obs_id = f"demo:{query.ra:.8f}:{query.dec:.8f}:{epoch}:{detector}"
                observations.append(
                    Observation(
                        id=hashlib.sha256(obs_id.encode()).hexdigest()[:24],
                        provider="demo",
                        collection="synthetic",
                        obs_id=obs_id,
                        ra=query.ra,
                        dec=query.dec,
                        mjd_start=mjd,
                        mjd_end=mjd + 100 / 86400,
                        detector=detector,
                        wavelength_min_um=lo,
                        wavelength_max_um=hi,
                        synthetic=True,
                    )
                )
        return SearchResult(
            query=query,
            observations=observations[: query.limit],
            possibly_truncated=len(observations) > query.limit,
            warnings=[
                "SYNTHETIC DEMO DATA: generated stars and a moving source; "
                "not observations from NASA or evidence of a discovery."
            ],
        )

    async def fetch(self, observation: Observation, request: JobRequest) -> bytes:
        if observation.provider != "demo":
            raise ArchiveError("Observation belongs to another provider")
        # Fixed native grid keeps sources at fixed sky positions across requested cutouts.
        size = 256
        wcs = WCS(naxis=2)
        wcs.wcs.crpix = [(size + 1) / 2] * 2
        wcs.wcs.crval = [observation.ra, observation.dec]
        wcs.wcs.cdelt = [-0.5 / size, 0.5 / size]
        wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]
        yy, xx = np.mgrid[:size, :size]
        rng = np.random.default_rng(42)
        image = np.full((size, size), 2.0)
        for x, y, amplitude in zip(
            rng.uniform(70, 185, 30), rng.uniform(70, 185, 30), rng.uniform(5, 30, 30), strict=True
        ):
            image += amplitude * np.exp(-((xx - x) ** 2 + (yy - y) ** 2) / 2)
        epoch = int(observation.obs_id.split(":")[-2])
        image += 50 * np.exp(-((xx - (123 + epoch * 2)) ** 2 + (yy - 128) ** 2) / 2)
        noise = np.random.default_rng(int(observation.id[:8], 16))
        image += noise.normal(0, 0.2, image.shape)
        header = wcs.to_header()
        header["BUNIT"] = "MJy/sr"
        header["SYNTHET"] = True
        flags = np.zeros(image.shape, dtype=np.int32)
        flags[128, 128] = 1 << 21
        flags[130, 130] = 1
        hdus = fits.HDUList(
            [
                fits.PrimaryHDU(),
                fits.ImageHDU(image.astype("f4"), header, name="IMAGE"),
                fits.ImageHDU(flags, name="FLAGS"),
                fits.ImageHDU(np.full(image.shape, 0.04, dtype="f4"), name="VARIANCE"),
                fits.ImageHDU(np.full(image.shape, 2.0, dtype="f4"), name="ZODI"),
            ]
        )
        buffer = io.BytesIO()
        hdus.writeto(buffer)
        return buffer.getvalue()
