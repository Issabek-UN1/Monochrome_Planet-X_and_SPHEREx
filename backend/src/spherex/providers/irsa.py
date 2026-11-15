import asyncio
import csv
import hashlib
import io
import math
import re
from urllib.parse import unquote, urlsplit

import httpx

from spherex.config import DETECTOR_BANDS, Settings
from spherex.errors import ArchiveError
from spherex.models import JobRequest, Observation, SearchResult, SkySearch
from spherex.providers.http import ATTEMPTS, archive_failure, retry_delay

SIA_URL = "https://irsa.ipac.caltech.edu/SIA"


def validate_data_url(url: str) -> str:
    if not isinstance(url, str) or not url:
        raise ArchiveError("Archive returned a missing data URL")
    parts = urlsplit(url)
    decoded = unquote(parts.path)
    if (
        parts.scheme != "https"
        or parts.netloc != "irsa.ipac.caltech.edu"
        or not decoded.startswith("/ibe/data/spherex/")
        or not decoded.endswith(".fits")
        or parts.query
        or parts.fragment
        or ".." in decoded
        or "\\" in decoded
    ):
        raise ArchiveError("Archive returned an unsupported data URL")
    return url


def number(value: str | None) -> float | None:
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None


def parse_csv(body: bytes, query: SkySearch, collections: list[str]) -> SearchResult:
    try:
        reader = csv.DictReader(io.StringIO(body.decode("utf-8-sig")), strict=True)
        if not {"access_url", "obs_id"}.issubset(reader.fieldnames or []):
            raise ArchiveError("Archive did not return the expected SIA CSV columns")
        observations = []
        seen = set()
        row_count = 0
        for row in reader:
            row_count += 1
            if None in row or not row.get("obs_id"):
                raise ArchiveError("Invalid SIA row: missing observation ID or excess columns")
            url = validate_data_url(row.get("access_url", ""))
            identifier = hashlib.sha256(url.encode()).hexdigest()[:24]
            if identifier in seen:
                continue
            seen.add(identifier)
            match = re.search(r"D([1-6])_", url)
            detector = int(match[1]) if match else None
            if query.detector is not None and detector != query.detector:
                continue
            lo, hi = number(row.get("em_min")), number(row.get("em_max"))
            if query.detector is not None:
                if query.wavelength_min_um is not None and (
                    hi is None or hi * 1e6 < query.wavelength_min_um
                ):
                    continue
                if query.wavelength_max_um is not None and (
                    lo is None or lo * 1e6 > query.wavelength_max_um
                ):
                    continue
            observations.append(
                Observation(
                    id=identifier,
                    provider="irsa",
                    collection=row.get("obs_collection") or ",".join(collections),
                    obs_id=row["obs_id"],
                    access_url=url,
                    ra=number(row.get("s_ra")),
                    dec=number(row.get("s_dec")),
                    mjd_start=number(row.get("t_min")),
                    mjd_end=number(row.get("t_max")),
                    wavelength_min_um=lo * 1e6 if lo is not None else None,
                    wavelength_max_um=hi * 1e6 if hi is not None else None,
                    detector=detector,
                )
            )
        observations.sort(key=lambda o: (o.mjd_start is None, o.mjd_start or 0, o.id))
        return SearchResult(
            query=query,
            observations=observations[: query.limit],
            possibly_truncated=row_count >= query.limit,
            warnings=[
                "SIA matches image footprints; a target can fall outside "
                "an individual image. Results are not a complete time series "
                "when possibly_truncated=true."
            ],
        )
    except (UnicodeError, csv.Error, ValueError) as exc:
        raise ArchiveError("Invalid SIA response") from exc


class IRSAProvider:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def _get(self, url: str, params, limit: int, operation="search") -> bytes:
        for attempt in range(ATTEMPTS):
            try:
                async with httpx.AsyncClient(
                    timeout=self.settings.http_timeout_seconds,
                    follow_redirects=False,
                    headers={"User-Agent": "Monochrome-SPHEREx/0.1 (Space Apps prototype)"},
                ) as client:
                    async with client.stream("GET", url, params=params) as response:
                        response.raise_for_status()
                        if response.is_redirect:
                            raise ArchiveError("Archive redirects are not followed")
                        content = bytearray()
                        async for chunk in response.aiter_bytes():
                            content.extend(chunk)
                            if len(content) > limit:
                                raise ArchiveError("Archive response exceeds configured size limit")
                        return bytes(content)
            except httpx.HTTPError as exc:
                delay = retry_delay(exc, attempt)
                if attempt < ATTEMPTS - 1 and delay is not None:
                    await asyncio.sleep(delay)
                    continue
                raise archive_failure(exc, operation) from exc
        raise ArchiveError("IRSA request failed")

    async def search(self, query: SkySearch) -> SearchResult:
        params = [("COLLECTION", c) for c in self.settings.collections]
        params += [
            ("POS", f"CIRCLE {query.ra} {query.dec} {query.radius_deg}"),
            ("MAXREC", str(query.limit)),
            ("RESPONSEFORMAT", "CSV"),
            ("DPTYPE", "image"),
        ]
        if query.mjd_min is not None or query.mjd_max is not None:
            lo = query.mjd_min if query.mjd_min is not None else "-Inf"
            hi = query.mjd_max if query.mjd_max is not None else "+Inf"
            params.append(("TIME", f"{lo} {hi}"))
        lo, hi = query.wavelength_min_um, query.wavelength_max_um
        if query.detector is not None:
            band_lo, band_hi = DETECTOR_BANDS[query.detector - 1]
            # Real calibrated band edges overlap adjacent detectors. A full nominal
            # interval can exhaust MAXREC on those neighbours before finding this
            # detector. Use an interior wavelength, then verify detector and any
            # requested wavelength overlap against the returned metadata above.
            params.append(("BAND", str((band_lo + band_hi) / 2 * 1e-6)))
        elif lo is not None or hi is not None:
            params.append(
                (
                    "BAND",
                    f"{lo * 1e-6 if lo is not None else '-Inf'} "
                    f"{hi * 1e-6 if hi is not None else '+Inf'}",
                )
            )
        body = await self._get(SIA_URL, params, 8 * 1024 * 1024)
        return parse_csv(body, query, self.settings.collections)

    async def fetch(self, observation: Observation, request: JobRequest) -> bytes:
        if observation.provider != "irsa" or observation.access_url is None:
            raise ArchiveError("Observation belongs to another provider; repeat the search")
        url = validate_data_url(observation.access_url)
        return await self._get(
            url,
            {"center": f"{request.ra},{request.dec}d", "size": str(request.fov_deg)},
            self.settings.max_download_bytes,
            operation=f"cutout {observation.obs_id}",
        )
