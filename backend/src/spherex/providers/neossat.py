"""Public CADC ObsTAP and DataLink adapter; no CSA notebook code is copied."""

import asyncio
import csv
import hashlib
import io
import re
from urllib.parse import unquote, urljoin, urlsplit

import httpx
from astropy.io.votable import parse_single_table

from spherex.config import Settings
from spherex.errors import ArchiveError
from spherex.models import JobRequest, Observation, SearchResult, SkySearch
from spherex.providers.http import ATTEMPTS, archive_failure, retry_delay
from spherex.providers.irsa import number

HOST = "ws.cadc-ccda.hia-iha.nrc-cnrc.gc.ca"
TAP = f"https://{HOST}/argus/sync"
DATALINK = f"https://{HOST}/caom2ops/datalink"


def validate_url(url: str, redirect: bool = False) -> str:
    p = urlsplit(url)
    path = unquote(p.path)
    allowed = (
        (p.netloc == HOST and p.path in ("/argus/sync", "/caom2ops/datalink"))
        or (
            p.netloc == "cadc-west-01.canfar.net"
            and re.fullmatch(r"/raven/files/cadc:NEOSSAT/[A-Za-z0-9_.-]+\.fits(?:\.gz)?", path)
        )
        or (
            redirect
            and p.netloc in ("ws-cadc.canfar.net", "ws-uv.canfar.net", "ws-sf.canfar.net")
            and p.path.startswith("/minoc/files/")
            and "/cadc:NEOSSAT/" in path
        )
    )
    if p.scheme != "https" or not allowed or ".." in path or "\\" in path or p.fragment:
        raise ArchiveError("Unsupported CADC URL")
    return url


class NEOSSatProvider:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def _get(self, url: str, params=None, limit: int | None = None) -> bytes:
        validate_url(url)
        limit = limit or self.settings.max_download_bytes
        for attempt in range(ATTEMPTS):
            current_url, current_params = url, params
            try:
                async with httpx.AsyncClient(
                    timeout=self.settings.http_timeout_seconds, follow_redirects=False
                ) as client:
                    for _hop in range(4):
                        async with client.stream(
                            "GET", current_url, params=current_params
                        ) as response:
                            if response.is_redirect:
                                location = response.headers.get("location")
                                if not location:
                                    raise ArchiveError("CADC redirect has no destination")
                                current_url = validate_url(
                                    urljoin(str(response.url), location),
                                    redirect=True,
                                )
                                current_params = None
                                continue
                            response.raise_for_status()
                            data = bytearray()
                            async for chunk in response.aiter_bytes():
                                data.extend(chunk)
                                if len(data) > limit:
                                    raise ArchiveError(
                                        "CADC response exceeds configured size limit"
                                    )
                            return bytes(data)
                    raise ArchiveError("Too many CADC redirects")
            except httpx.HTTPError as exc:
                delay = retry_delay(exc, attempt)
                if attempt < ATTEMPTS - 1 and delay is not None:
                    await asyncio.sleep(delay)
                    continue
                raise archive_failure(exc, "request", archive="CADC") from exc
        raise ArchiveError("CADC request failed")

    async def search(self, query: SkySearch) -> SearchResult:
        # All interpolated fields are Pydantic-validated finite numbers, never user ADQL.
        constraints = [
            "obs_collection='NEOSSAT'",
            "dataproduct_type='image'",
            "calib_level>=2",
            f"INTERSECTS(s_region, CIRCLE('ICRS', {query.ra}, {query.dec}, {query.radius_deg}))=1",
        ]
        if query.mjd_min is not None:
            constraints.append(f"t_max>={query.mjd_min}")
        if query.mjd_max is not None:
            constraints.append(f"t_min<={query.mjd_max}")
        # SkySearch wavelength limits describe SPHEREx, and must never be silently ignored.
        if query.wavelength_min_um is not None or query.wavelength_max_um is not None:
            raise ValueError("Wavelength filters are currently supported only for SPHEREx")
        adql = f"SELECT TOP {query.limit} * FROM ivoa.ObsCore WHERE " + " AND ".join(constraints)
        body = await self._get(
            TAP,
            {"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "QUERY": adql},
            limit=8 * 1024 * 1024,
        )
        try:
            reader = csv.DictReader(io.StringIO(body.decode("utf-8-sig")), strict=True)
            if not {"obs_id", "access_url", "obs_publisher_did"}.issubset(reader.fieldnames or []):
                raise ArchiveError("Invalid CADC ObsCore response")
            observations = {}
            for row in reader:
                if None in row:
                    raise ArchiveError("Invalid CADC ObsCore row: excess columns")
                did = row.get("obs_publisher_did") or ""
                if not re.fullmatch(r"ivo://cadc\.nrc\.ca/NEOSSAT\?\d+/(?:cor|cord)", did):
                    continue
                identifier = hashlib.sha256(did.encode()).hexdigest()[:24]
                lo, hi = number(row.get("em_min")), number(row.get("em_max"))
                observations[identifier] = Observation(
                    exposure_seconds=number(row.get("t_exptime")),
                    product_type=did.rsplit("/", 1)[-1],
                    id=identifier,
                    provider="neossat",
                    collection="NEOSSAT",
                    obs_id=did,
                    access_url=None,
                    ra=number(row.get("s_ra")),
                    dec=number(row.get("s_dec")),
                    mjd_start=number(row.get("t_min")),
                    mjd_end=number(row.get("t_max")),
                    wavelength_min_um=lo * 1e6 if lo else None,
                    wavelength_max_um=hi * 1e6 if hi else None,
                )
            items = sorted(observations.values(), key=lambda o: o.mjd_start or 0)
            return SearchResult(
                query=query,
                observations=items,
                possibly_truncated=len(body.decode().splitlines()) - 1 >= query.limit,
                warnings=[
                    "NEOSSat COR/CORD count images; not SPHEREx infrared data. "
                    "Footprint intersections do not guarantee usable cutouts."
                ],
            )
        except (UnicodeError, csv.Error, ValueError) as exc:
            raise ArchiveError("Invalid CADC response") from exc

    async def fetch(self, observation: Observation, request: JobRequest) -> bytes:
        if observation.provider != "neossat" or not re.fullmatch(
            r"ivo://cadc\.nrc\.ca/NEOSSAT\?\d+/(?:cor|cord)", observation.obs_id
        ):
            raise ArchiveError("Unsupported NEOSSat product")
        body = await self._get(DATALINK, {"ID": observation.obs_id}, limit=2 * 1024 * 1024)
        try:
            table = parse_single_table(io.BytesIO(body)).to_table()
            for row in table:
                if str(row["semantics"]) == "#this" and "fits" in str(row["content_type"]):
                    return await self._get(validate_url(str(row["access_url"])))
        except (ValueError, KeyError) as exc:
            raise ArchiveError("Invalid CADC DataLink response") from exc
        raise ArchiveError("No public FITS product in CADC DataLink response")
