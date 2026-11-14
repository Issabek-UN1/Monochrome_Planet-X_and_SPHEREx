import io

import numpy as np
import pytest
from astropy.io import fits

from spherex.models import JobRequest
from spherex.science import Frame, align_fits, combine, target_wcs


def request(**kwargs):
    return JobRequest(kind="cutout", observation_ids=["a" * 24], ra=0, dec=0, size_px=32, **kwargs)


def source_fits(req, flag=0, pixel_offset=0):
    header = target_wcs(req).to_header()
    header["CRPIX1"] += pixel_offset
    header["CRPIX2"] += pixel_offset
    header["BUNIT"] = "MJy/sr"
    shape = (req.size_px, req.size_px)
    hdus = fits.HDUList(
        [
            fits.PrimaryHDU(),
            fits.ImageHDU(np.full(shape, 12.0), header, name="IMAGE"),
            fits.ImageHDU(np.full(shape, 4.0), name="VARIANCE"),
            fits.ImageHDU(np.full(shape, flag, dtype=np.int32), name="FLAGS"),
            fits.ImageHDU(np.full(shape, 2.0), name="ZODI"),
        ]
    )
    body = io.BytesIO()
    hdus.writeto(body)
    return body.getvalue()


def test_identity_grid_zodi_and_flags():
    req = request()
    frame = align_fits(source_fits(req, 1 << 21), req)
    assert np.nanmedian(frame.image) == pytest.approx(10)
    assert np.nanmedian(frame.variance) == pytest.approx(4)
    assert np.all(frame.flags == 1 << 21)
    with pytest.raises(ValueError, match="No usable pixels"):
        align_fits(source_fits(req, 1), req)
    unmasked = request(reject_flags=0, subtract_zodi=False)
    assert np.nanmedian(align_fits(source_fits(req, 1), unmasked).image) == pytest.approx(12)


def frame(value, variance):
    data = np.full((2, 2), value, dtype=float)
    return Frame(
        data,
        np.full_like(data, variance),
        np.zeros((2, 2), dtype=np.uint32),
        np.ones((2, 2)),
        target_wcs(request()),
    )


def test_weighted_mean_and_difference_uncertainties():
    a, b = frame(10, 4), frame(20, 1)
    stack = combine([a, b])
    assert np.allclose(stack.image, 18)
    assert np.allclose(stack.variance, 0.8)
    assert np.all(stack.coverage == 2)
    diff = combine([a, b], difference=True)
    assert np.allclose(diff.image, 10)
    assert np.allclose(diff.variance, 5)


def test_half_pixel_resampling_uses_squared_variance_weights():
    req = request()
    aligned = align_fits(source_fits(req, pixel_offset=0.5), req)
    assert aligned.image[16, 16] == pytest.approx(10)
    # Four independent neighbours with variance 4 and weights 1/4: 4 * (1/4)^2 * 4 = 1.
    assert aligned.variance[16, 16] == pytest.approx(1)


def test_masked_pixels_are_not_zero_flux():
    a, b = frame(10, 4), frame(20, 1)
    b.image[0, 0] = np.nan
    result = combine([a, b])
    assert result.image[0, 0] == 10
    assert result.variance[0, 0] == 4
    assert result.coverage[0, 0] == 1
    assert np.isnan(combine([a, b], difference=True).image[0, 0])
