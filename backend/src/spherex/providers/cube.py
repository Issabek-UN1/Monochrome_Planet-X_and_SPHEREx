"""Read only FITS headers, channel tables and requested pixel via HTTP Range."""

import asyncio
import math
import re
from pathlib import Path

import httpx
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy_healpix import HEALPix

from spherex.config import Settings
from spherex.errors import ArchiveError
from spherex.providers.http import ATTEMPTS, archive_failure, retry_delay
from spherex.providers.irsa import validate_data_url

CUBE_RELEASE = "hips_20261026"
CUBE_ROOT = f"https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/hips5_cube/{CUBE_RELEASE}"


def cube_url(ra: float, dec: float) -> str:
    pixel = int(
        HEALPix(nside=32, order="nested", frame="icrs").skycoord_to_healpix(
            SkyCoord(ra, dec, unit="deg", frame="icrs")
        )
    )
    return validate_data_url(
        f"{CUBE_ROOT}/Norder5/Dir{pixel // 10000 * 10000}/Npix{pixel}_cube.fits"
    )


class CubeReader:
    def __init__(self, url: str, client: httpx.AsyncClient, settings: Settings):
        validate_data_url(url)
        if not url.startswith(CUBE_ROOT + "/Norder5/"):
            raise ArchiveError("Unsupported cube release")
        self.url, self.client, self.settings = url, client, settings
        self.total = None
        self.etag = None
        self.modified = None
        self.images = {}
        self.bytes_received = 0
        self.semaphore = asyncio.Semaphore(6)

    async def read(self, start: int, length: int) -> bytes:
        if start < 0 or length <= 0 or length > 65536:
            raise ArchiveError("Invalid cube byte range")
        if self.total is not None and start >= self.total:
            raise ArchiveError("Cube byte range starts beyond end of file")
        end = start + length - 1
        if self.total is not None:
            end = min(end, self.total - 1)
        headers = {"Range": f"bytes={start}-{end}", "Accept-Encoding": "identity"}
        if self.etag and not self.etag.startswith("W/"):
            headers["If-Match"] = self.etag
        elif self.modified:
            headers["If-Unmodified-Since"] = self.modified
        async with self.semaphore:
            for attempt in range(ATTEMPTS):
                try:
                    async with self.client.stream("GET", self.url, headers=headers) as response:
                        response.raise_for_status()
                        match = re.fullmatch(
                            r"bytes (\d+)-(\d+)/(\d+)", response.headers.get("Content-Range", "")
                        )
                        if response.status_code != 206 or not match:
                            raise ArchiveError(
                                "IRSA must support exact HTTP byte ranges for cube extraction"
                            )
                        lo, hi, total = map(int, match.groups())
                        if (
                            total <= hi
                            or lo > hi
                            or lo != start
                            or hi != end
                            or total > self.settings.max_cube_download_bytes
                        ):
                            raise ArchiveError("Invalid or oversized cube byte range")
                        if self.total is not None and total != self.total:
                            raise ArchiveError("Cube changed while extracting spectrum")
                        if self.etag and response.headers.get("ETag") != self.etag:
                            raise ArchiveError("Cube version changed while extracting spectrum")
                        if self.modified and response.headers.get("Last-Modified") != self.modified:
                            raise ArchiveError(
                                "Cube modification time changed while extracting spectrum"
                            )
                        self.total = total
                        self.etag = response.headers.get("ETag")
                        self.modified = response.headers.get("Last-Modified")
                        body = bytearray()
                        async for chunk in response.aiter_bytes():
                            body.extend(chunk)
                            if len(body) > length:
                                raise ArchiveError("Cube server exceeded requested byte range")
                        if len(body) != hi - lo + 1:
                            raise ArchiveError("Truncated cube byte range")
                        self.bytes_received += len(body)
                        return bytes(body)
                except httpx.HTTPError as exc:
                    delay = retry_delay(exc, attempt)
                    if attempt < ATTEMPTS - 1 and delay is not None:
                        await asyncio.sleep(delay)
                        continue
                    raise archive_failure(exc, "DR1 cube extraction") from exc
        raise ArchiveError("Cube request failed")

    async def prepare(self, destination: Path):
        """Create a temporary partial FITS; only the subsequently fetched pixel is valid."""
        offset = 0
        with destination.open("wb") as output:
            for _ in range(8):
                body = await self.read(offset, 11520)
                end_card = next(
                    (i for i in range(0, len(body), 80) if body[i : i + 8] == b"END     "), None
                )
                if end_card is None:
                    raise ArchiveError("Unsupported cube FITS header size")
                header_length = math.ceil((end_card + 80) / 2880) * 2880
                header = fits.Header.fromstring(body[:header_length].decode("ascii"))
                shape = [int(header[f"NAXIS{i}"]) for i in range(1, header.get("NAXIS", 0) + 1)]
                size = (math.prod(shape) if shape else 0) * abs(header["BITPIX"]) // 8
                size += int(header.get("PCOUNT", 0))
                data_offset = offset + header_length
                if data_offset + size > self.total:
                    raise ArchiveError("Cube HDU exceeds file size")
                output.seek(offset)
                output.write(body[:header_length])
                name = header.get("EXTNAME", "PRIMARY")
                if name in ("IMAGE", "NHITS", "FLAGS"):
                    if (
                        len(shape) != 3
                        or shape[2] != 102
                        or max(shape[:2]) > 512
                        or abs(header["BITPIX"]) != 32
                    ):
                        raise ArchiveError("Unsupported DR1 cube layout")
                    self.images[name] = (data_offset, shape)
                elif name in ("SPECTRAL_CHANNELS", "WCS-WAVE"):
                    output.seek(data_offset)
                    output.write(await self.read(data_offset, size))
                offset = data_offset + math.ceil(size / 2880) * 2880
                if offset == self.total:
                    break
            else:
                raise ArchiveError("Too many cube extensions")
            output.truncate(self.total)
        if set(self.images) != {"IMAGE", "NHITS", "FLAGS"}:
            raise ArchiveError("Cube lacks required image extensions")

    async def fill_pixel(self, destination: Path, x: int, y: int):
        async def fetch(offset):
            return offset, await self.read(offset, 4)

        offsets = []
        for data_offset, shape in self.images.values():
            nx, ny, _ = shape
            if not 0 <= x < nx or not 0 <= y < ny:
                raise ArchiveError("Pixel outside cube quality plane")
            offsets.extend(data_offset + 4 * (layer * nx * ny + y * nx + x) for layer in range(102))
        # Collect all requests before closing client or removing the temporary file.
        results = await asyncio.gather(
            *(fetch(offset) for offset in offsets), return_exceptions=True
        )
        failures = [result for result in results if isinstance(result, BaseException)]
        if failures:
            raise failures[0]
        with destination.open("r+b") as output:
            for offset, body in results:
                output.seek(offset)
                output.write(body)
