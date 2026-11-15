from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Finite = Annotated[float, Field(allow_inf_nan=False)]
RA = Annotated[Finite, Field(ge=0, lt=360)]
Dec = Annotated[Finite, Field(ge=-90, le=90)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SkySearch(StrictModel):
    source: Literal["spherex", "neossat"] = "spherex"
    ra: RA
    dec: Dec
    radius_deg: Annotated[Finite, Field(gt=0, le=2)] = 0.05
    detector: int | None = Field(None, ge=1, le=6)
    mjd_min: Annotated[Finite, Field(ge=0)] | None = None
    mjd_max: Annotated[Finite, Field(ge=0)] | None = None
    wavelength_min_um: Annotated[Finite, Field(ge=0.75, le=5)] | None = None
    wavelength_max_um: Annotated[Finite, Field(ge=0.75, le=5)] | None = None
    limit: int = Field(100, ge=1, le=500)

    @model_validator(mode="after")
    def ordered_intervals(self):
        if self.source == "neossat" and self.detector is not None:
            raise ValueError("Detector selection is only supported for SPHEREx")
        for lo, hi in [
            (self.mjd_min, self.mjd_max),
            (self.wavelength_min_um, self.wavelength_max_um),
        ]:
            if lo is not None and hi is not None and lo > hi:
                raise ValueError("Interval minimum must not exceed maximum")
        return self


class Observation(BaseModel):
    exposure_seconds: Finite | None = None
    product_type: str | None = None
    id: str
    provider: Literal["irsa", "demo", "neossat"]
    collection: str
    obs_id: str
    access_url: str | None = None
    ra: Finite | None = None
    dec: Finite | None = None
    mjd_start: Finite | None = None
    mjd_end: Finite | None = None
    wavelength_min_um: Finite | None = None
    wavelength_max_um: Finite | None = None
    detector: int | None = None
    synthetic: bool = False


class SearchResult(BaseModel):
    query: SkySearch
    observations: list[Observation]
    possibly_truncated: bool
    cached: bool = False
    warnings: list[str] = Field(default_factory=list)


class JobKind(StrEnum):
    cutout = "cutout"
    stack = "stack"
    difference = "difference"
    blink = "blink"


class JobRequest(StrictModel):
    source: Literal["spherex", "neossat"] = "spherex"
    kind: JobKind
    observation_ids: list[Annotated[str, Field(pattern=r"^[a-f0-9]{24}$")]] = Field(
        min_length=1, max_length=12
    )
    ra: RA
    dec: Dec
    fov_deg: Annotated[Finite, Field(ge=0.005, le=0.5)] = 0.1
    size_px: int = Field(256, ge=32, le=512)
    # Source-mask bit 21 is informational; all other set bits are rejected by default.
    reject_flags: int = Field(0xFFDFFFFF, ge=0, le=0xFFFFFFFF)
    subtract_zodi: bool = True

    @model_validator(mode="after")
    def valid_selection(self):
        n = len(self.observation_ids)
        if len(set(self.observation_ids)) != n:
            raise ValueError("Observation IDs must be unique")
        if self.kind == JobKind.cutout and n != 1:
            raise ValueError("A cutout requires exactly one observation")
        if self.kind == JobKind.difference and n != 2:
            raise ValueError("A difference requires [reference, science] observations")
        if self.kind in (JobKind.stack, JobKind.blink) and n < 2:
            raise ValueError("Stack and blink require at least two observations")
        return self


class Artifact(BaseModel):
    name: str
    media_type: str
    url: str


class Job(BaseModel):
    id: str
    status: Literal["queued", "running", "succeeded", "failed"]
    request: JobRequest
    created_at: float
    updated_at: float
    attempts: int
    artifacts: list[Artifact] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None


class ErrorInfo(BaseModel):
    code: str
    message: str
    details: list[dict] | None = None
    request_id: str | None = None


class ErrorResponse(BaseModel):
    error: ErrorInfo


class DetectorBand(BaseModel):
    detector: int
    wavelength_min_um: float
    wavelength_max_um: float


class Capabilities(BaseModel):
    supplemental_sources: dict[str, list[str]] = Field(default_factory=dict)
    version: str
    provider: Literal["demo", "irsa"]
    synthetic: bool
    collections: list[str]
    operations: list[JobKind]
    bands: list[DetectorBand]
    coordinate_frame: str
    time_unit: str
    limits: dict[str, float]
    planned: list[str]
