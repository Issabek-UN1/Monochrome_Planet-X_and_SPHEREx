"""Count-preserving nearest-neighbour previews; no invented photometric uncertainties."""

import io

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS

from spherex.models import JobRequest
from spherex.science import Frame, target_wcs


def align_neossat(body: bytes, request: JobRequest) -> Frame:
    with fits.open(io.BytesIO(body), memmap=False) as hdus:
        hdu = hdus[0]
        image = np.asarray(hdu.data, dtype=float)
        if image.ndim != 2:
            raise ValueError("NEOSSat primary HDU must be a 2-D image")
        source = WCS(hdu.header).celestial
        if not source.has_celestial:
            raise ValueError("NEOSSat image has no celestial WCS; alignment is unavailable")
        unit = str(hdu.header.get("BUNIT", "adu")).strip()
        if unit.lower() not in ("adu", "count", "counts"):
            raise ValueError("Unsupported NEOSSat count unit")
        target = target_wcs(request)
        yy, xx = np.mgrid[: request.size_px, : request.size_px]
        x, y = source.world_to_pixel(target.pixel_to_world(xx, yy))
        finite = np.isfinite(x) & np.isfinite(y)
        x = np.rint(np.where(finite, x, -1)).astype(int)
        y = np.rint(np.where(finite, y, -1)).astype(int)
        valid = finite & (x >= 0) & (y >= 0) & (x < image.shape[1]) & (y < image.shape[0])
        result = np.full(xx.shape, np.nan)
        result[valid] = image[y[valid], x[valid]]
        valid &= np.isfinite(result)
        if not valid.any():
            raise ValueError("NEOSSat image has no usable pixels in this field")
        return Frame(
            result,
            np.full(xx.shape, np.nan),
            np.zeros(xx.shape, dtype=np.uint32),
            valid.astype(float),
            target,
            unit=unit,
            has_quality=False,
        )
