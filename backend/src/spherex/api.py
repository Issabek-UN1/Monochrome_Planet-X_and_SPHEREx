import hashlib
import json
import logging
from contextlib import asynccontextmanager
from typing import Annotated
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Path, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from spherex import __version__
from spherex.config import Settings
from spherex.errors import ArchiveError, QueueFull
from spherex.models import (
    Capabilities,
    ErrorResponse,
    Job,
    JobRequest,
    Observation,
    SearchResult,
    SkySearch,
)
from spherex.processing import validate_observations
from spherex.providers import make_provider
from spherex.storage import Store

logger = logging.getLogger(__name__)
JobId = Annotated[str, Path(pattern=r"^[a-f0-9]{32}$")]
ObservationId = Annotated[str, Path(pattern=r"^[a-f0-9]{24}$")]

BANDS = [
    {"detector": i, "wavelength_min_um": lo, "wavelength_max_um": hi}
    for i, (lo, hi) in enumerate(
        [
            (0.75, 1.09),
            (1.10, 1.62),
            (1.63, 2.41),
            (2.42, 3.82),
            (3.83, 4.41),
            (4.42, 5.00),
        ],
        1,
    )
]


def create_app(settings: Settings | None = None, provider=None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.store = Store(settings.data_dir)
        app.state.provider = provider or make_provider(settings)
        yield

    app = FastAPI(
        title="Monochrome SPHEREx API",
        version=__version__,
        lifespan=lifespan,
        description="Sky search and asynchronous exploratory imaging. "
        "All positions are ICRS degrees; times are MJD; wavelengths are micrometres.",
        responses={
            404: {"model": ErrorResponse, "description": "Resource not found"},
            410: {"model": ErrorResponse, "description": "Artifact no longer available"},
            422: {"model": ErrorResponse, "description": "Invalid parameters"},
            502: {"model": ErrorResponse, "description": "Upstream archive unavailable"},
        },
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        expose_headers=["X-Request-ID", "Location", "Retry-After"],
    )

    @app.middleware("http")
    async def request_id(request: Request, call_next):
        request.state.request_id = uuid4().hex
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    def error(request: Request, status: int, code: str, message: str, details=None, headers=None):
        return JSONResponse(
            status_code=status,
            headers=headers,
            content={
                "error": {
                    "code": code,
                    "message": message,
                    "details": details,
                    "request_id": getattr(request.state, "request_id", None),
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        details = [{k: item[k] for k in ("loc", "msg", "type")} for item in exc.errors()]
        return error(request, 422, "validation_error", "Invalid request parameters", details)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request, exc):
        return error(
            request, exc.status_code, "request_error", str(exc.detail), headers=exc.headers
        )

    @app.exception_handler(ArchiveError)
    async def archive_error(request, exc):
        return error(request, 502, "archive_error", str(exc))

    @app.get("/health/live", tags=["health"])
    def live() -> dict:
        return {"status": "ok", "version": __version__}

    @app.get("/health/ready", tags=["health"])
    def ready(request: Request) -> dict:
        with request.app.state.store.connection() as db:
            db.execute("SELECT 1")
        return {
            "status": "ok",
            "provider": settings.provider,
            "checks": {"database": "ok"},
            "note": "Does not check archive reachability or worker availability",
        }

    @app.get("/api/v1/capabilities", response_model=Capabilities, tags=["configuration"])
    def capabilities() -> dict:
        return {
            "version": __version__,
            "provider": settings.provider,
            "synthetic": settings.provider == "demo",
            "collections": ["synthetic"] if settings.provider == "demo" else settings.collections,
            "operations": ["cutout", "stack", "difference", "blink"],
            "bands": BANDS,
            "coordinate_frame": "ICRS",
            "time_unit": "MJD",
            "limits": {
                "radius_deg": 2,
                "fov_deg": 0.5,
                "size_px": 512,
                "observations_per_job": 12,
                "search_results": 500,
            },
            "planned": [
                "calibrated_spectra",
                "gaia_overlay",
                "wise_overlay",
                "wavelength_matched_differences",
                "moving_source_candidates",
            ],
        }

    @app.get("/api/v1/observations", response_model=SearchResult, tags=["observations"])
    async def observations(request: Request, query: Annotated[SkySearch, Query()]):
        key = hashlib.sha256(
            json.dumps(
                {
                    "provider": settings.provider,
                    "collections": settings.collections,
                    "query": query.model_dump(),
                    "schema": __version__,
                },
                sort_keys=True,
            ).encode()
        ).hexdigest()
        store = request.app.state.store
        cached = store.cached_search(key)
        if cached is not None:
            return cached
        result = await request.app.state.provider.search(query)
        store.save_search(key, result, settings.search_ttl_seconds)
        return result

    @app.get(
        "/api/v1/observations/{observation_id}", response_model=Observation, tags=["observations"]
    )
    def observation(request: Request, observation_id: ObservationId):
        result = request.app.state.store.observation(observation_id)
        if result is None:
            raise HTTPException(404, "Observation not found; search by coordinates first")
        return result

    @app.post(
        "/api/v1/jobs",
        response_model=Job,
        status_code=202,
        tags=["jobs"],
        responses={429: {"model": ErrorResponse, "description": "Queue capacity reached"}},
    )
    def submit(request: Request, body: JobRequest):
        store = request.app.state.store
        try:
            validate_observations(body, store, settings.provider)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        try:
            job = store.enqueue(body, settings.max_pending_jobs)
        except QueueFull as exc:
            raise HTTPException(
                429, "Processing queue is full; try again later", headers={"Retry-After": "30"}
            ) from exc
        return JSONResponse(
            status_code=202,
            content=job.model_dump(mode="json"),
            headers={
                "Location": f"/api/v1/jobs/{job.id}",
                "Retry-After": "2",
            },
        )

    @app.get("/api/v1/jobs/{job_id}", response_model=Job, tags=["jobs"])
    def job(request: Request, job_id: JobId):
        result = request.app.state.store.job(job_id)
        if result is None:
            raise HTTPException(404, "Job not found")
        return result

    @app.get("/api/v1/jobs/{job_id}/artifacts/{name}", tags=["jobs"], response_class=FileResponse)
    def artifact(request: Request, job_id: JobId, name: str):
        store = request.app.state.store
        job = store.job(job_id)
        if job is None or job.status != "succeeded":
            raise HTTPException(404, "Completed job not found")
        artifact = next((a for a in job.artifacts if a.name == name), None)
        if artifact is None:
            raise HTTPException(404, "Artifact not found")
        path = store.root / "artifacts" / job_id / str(job.attempts) / artifact.name
        if not path.is_file():
            raise HTTPException(410, "Artifact no longer available")
        return FileResponse(path, media_type=artifact.media_type)

    return app


app = create_app()
