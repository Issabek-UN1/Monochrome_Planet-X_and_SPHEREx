"""WCS-aware exploratory imaging, deliberately separate from HTTP and persistence."""

import io
from dataclasses import dataclass

import numpy as np
from astropy import units as u
from astropy.io import fits
from astropy.wcs import WCS
from PIL import Image

from spherex.models import JobRequest


@dataclass
class Frame:
    image: np.ndarray
    variance: np.ndarray
    flags: np.ndarray
    coverage: np.ndarray
    wcs: WCS


def target_wcs(request: JobRequest) -> WCS:
    wcs = WCS(naxis=2)
    wcs.wcs.crpix = [(request.size_px + 1) / 2] * 2
    wcs.wcs.crval = [request.ra, request.dec]
    scale = request.fov_deg / request.size_px
    wcs.wcs.cdelt = [-scale, scale]
    wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    wcs.wcs.radesys = "ICRS"
    return wcs


def align_fits(body: bytes, request: JobRequest) -> Frame:
    """Bilinear surface-brightness resampling with squared-weight variance propagation.

    Only fully supported output pixels survive; masked neighbours are not filled in.
    Flags retain the OR of geometric contributors, including rejected neighbours.
    """
    with fits.open(io.BytesIO(body), memmap=False) as hdus:
        image_hdu = hdus["IMAGE"]
        unit = u.Unit(image_hdu.header.get("BUNIT", ""))
        factor = unit.to(u.MJy / u.sr)
        image = np.asarray(image_hdu.data, dtype=np.float64) * factor
        variance = np.asarray(hdus["VARIANCE"].data, dtype=np.float64) * factor**2
        flags = np.asarray(hdus["FLAGS"].data, dtype=np.uint32)
        if request.subtract_zodi:
            zodi = np.asarray(hdus["ZODI"].data, dtype=np.float64) * factor
            image = image - zodi
        if image.ndim != 2 or variance.shape != image.shape or flags.shape != image.shape:
            raise ValueError("IMAGE, VARIANCE and FLAGS must be matching 2-D planes")
        source = WCS(image_hdu.header, fobj=hdus).celestial
        if not source.has_celestial:
            raise ValueError("FITS image has no celestial WCS")
        target = target_wcs(request)
        yy, xx = np.mgrid[: request.size_px, : request.size_px]
        sky = target.pixel_to_world(xx, yy)
        sx, sy = source.world_to_pixel(sky)
        finite = np.isfinite(sx) & np.isfinite(sy)
        sx = np.where(finite, sx, -1e9)
        sy = np.where(finite, sy, -1e9)
        x0, y0 = np.floor(sx).astype(np.int64), np.floor(sy).astype(np.int64)
        fx, fy = sx - x0, sy - y0
        result, out_var, coverage = [np.zeros(xx.shape, dtype=np.float64) for _ in range(3)]
        out_flags = np.zeros(xx.shape, dtype=np.uint32)
        for dx, dy, weight in [
            (0, 0, (1 - fx) * (1 - fy)),
            (1, 0, fx * (1 - fy)),
            (0, 1, (1 - fx) * fy),
            (1, 1, fx * fy),
        ]:
            x, y = x0 + dx, y0 + dy
            inside = finite & (x >= 0) & (y >= 0) & (x < image.shape[1]) & (y < image.shape[0])
            cx, cy = np.clip(x, 0, image.shape[1] - 1), np.clip(y, 0, image.shape[0] - 1)
            values, variances, bits = image[cy, cx], variance[cy, cx], flags[cy, cx]
            contributes = inside & (weight > 1e-12)
            out_flags |= np.where(contributes, bits, 0).astype(np.uint32)
            valid = (
                inside
                & np.isfinite(values)
                & np.isfinite(variances)
                & (variances > 0)
                & ((bits & request.reject_flags) == 0)
            )
            weights = np.where(valid, weight, 0)
            result += weights * np.where(valid, values, 0)
            out_var += weights**2 * np.where(valid, variances, 0)
            coverage += weights
        valid = coverage >= 1 - 1e-6
        result = np.divide(result, coverage, out=np.full_like(result, np.nan), where=valid)
        out_var = np.divide(out_var, coverage**2, out=np.full_like(out_var, np.nan), where=valid)
        if not np.any(valid):
            raise ValueError("No usable pixels at this position with the selected flags")
        return Frame(result, out_var, out_flags, coverage, target)


def combine(frames: list[Frame], difference: bool = False) -> Frame:
    images = np.stack([f.image for f in frames])
    variances = np.stack([f.variance for f in frames])
    if difference:
        image = images[1] - images[0]
        variance = variances[1] + variances[0]
        coverage = np.minimum(frames[0].coverage, frames[1].coverage)
    else:
        valid = np.isfinite(images) & np.isfinite(variances) & (variances > 0)
        weights = np.divide(1, variances, out=np.zeros_like(variances), where=valid)
        total = weights.sum(axis=0)
        image = np.divide(
            (weights * np.where(valid, images, 0)).sum(axis=0),
            total,
            out=np.full_like(total, np.nan),
            where=total > 0,
        )
        variance = np.divide(1, total, out=np.full_like(total, np.nan), where=total > 0)
        coverage = valid.sum(axis=0).astype(float)
    flags = np.bitwise_or.reduce(np.stack([f.flags for f in frames]), axis=0)
    return Frame(image, variance, flags, coverage, frames[0].wcs)


def fits_bytes(frame: Frame, synthetic: bool, coverage_count: bool = False) -> bytes:
    header = frame.wcs.to_header()
    header["BUNIT"] = "MJy/sr"
    header["SYNTHET"] = synthetic
    header["HISTORY"] = "Exploratory product; see accompanying provenance.json"
    var_header = frame.wcs.to_header()
    var_header["BUNIT"] = "(MJy/sr)^2"
    coverage_header = frame.wcs.to_header()
    coverage_header["BUNIT"] = "count" if coverage_count else "fraction"
    hdus = fits.HDUList(
        [
            fits.PrimaryHDU(),
            fits.ImageHDU(frame.image.astype("f4"), header, name="IMAGE"),
            fits.ImageHDU(frame.variance.astype("f4"), var_header, name="VARIANCE"),
            fits.ImageHDU(frame.flags, frame.wcs.to_header(), name="FLAGS"),
            fits.ImageHDU(frame.coverage.astype("f4"), coverage_header, name="COVERAGE"),
        ]
    )
    buffer = io.BytesIO()
    hdus.writeto(buffer, checksum=True)
    return buffer.getvalue()


def preview_images(frames: list[Frame], difference: bool = False) -> list[Image.Image]:
    values = np.concatenate([f.image[np.isfinite(f.image)] for f in frames])
    if not values.size:
        raise ValueError("No overlapping valid pixels to display")
    if difference:
        bound = max(float(np.percentile(np.abs(values), 99)), 1e-10)
        lo, hi = -bound, bound
    else:
        lo, hi = np.percentile(values, [1, 99.5])
        hi = max(hi, lo + 1e-10)
    images = []
    for frame in frames:
        normalized = np.clip((frame.image - lo) / (hi - lo), 0, 1)
        if not difference:
            normalized = np.arcsinh(normalized * 10) / np.arcsinh(10)
        pixels = (np.nan_to_num(normalized, nan=0) * 255).astype(np.uint8)
        # FITS row zero is bottom; browser row zero is top. East remains left.
        images.append(Image.fromarray(np.flipud(pixels)))
    return images
