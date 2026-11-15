import asyncio
import json
from pathlib import Path

from spherex import __version__
from spherex.models import Artifact, Job, JobKind, JobRequest, Observation
from spherex.neossat_science import align_neossat
from spherex.providers.base import Provider
from spherex.science import Frame, align_fits, combine, fits_bytes, preview_images
from spherex.storage import Store

SCIENCE_WARNINGS = [
    "Exploratory visualization, not calibrated source photometry or a moving-object detection.",
    "Within a detector, wavelength varies by pixel and visit. Detector-level stacks and "
    "differences are not wavelength-matched. Color or background changes can mimic motion.",
    "No PSF matching, astrometric refinement, background fitting or outlier clipping. "
    "Variance assumes independent inputs and omits resampling covariance and model uncertainty.",
]


def validate_observations(request: JobRequest, store: Store, provider: str) -> list[Observation]:
    if request.kind == JobKind.spectrum:
        if provider != "irsa":
            raise ValueError("Real DR1 cube spectra require SPHEREX_PROVIDER=irsa")
        return []
    if request.source == "neossat":
        provider = "neossat"
        if request.kind not in (JobKind.cutout, JobKind.blink):
            raise ValueError("NEOSSat currently supports only cutout and blink")
        if request.subtract_zodi or request.reject_flags != 0:
            raise ValueError("For NEOSSat set subtract_zodi=false and reject_flags=0")
    observations = []
    for identifier in request.observation_ids:
        observation = store.observation(identifier)
        if observation is None:
            raise ValueError("Unknown observation ID; search before creating a job")
        if observation.provider != provider:
            raise ValueError("Observation provider changed; repeat the search")
        observations.append(observation)
    if request.kind in (JobKind.stack, JobKind.difference):
        detectors = {o.detector for o in observations}
        if None in detectors or len(detectors) != 1:
            raise ValueError("Stacks and differences require observations from one known detector")
    return observations


def render(
    job: Job, observations: list[Observation], frames: list[Frame], output: Path
) -> tuple[list[Artifact], list[str]]:
    output.mkdir(parents=True, exist_ok=True)
    warnings = list(SCIENCE_WARNINGS)
    if job.request.source == "neossat":
        warnings = [
            "NEOSSat COR/CORD preview in detector counts, without flux calibration. "
            "Nearest-neighbour WCS alignment uses archived astrometry. "
            "No SPHEREx FLAGS, variance, ZODI or motion detection is provided. "
            "Exposure, tracking and background changes can mimic variability."
        ]
    synthetic = any(o.synthetic for o in observations)
    if synthetic:
        warnings.insert(0, "SYNTHETIC DEMO DATA: not NASA observations.")
    if job.request.kind == JobKind.blink:
        # Time order is stable; provenance records this order explicitly.
        order = sorted(
            range(len(frames)),
            key=lambda i: (observations[i].mjd_start is None, observations[i].mjd_start or 0),
        )
        frames = [frames[i] for i in order]
        observations = [observations[i] for i in order]
        if len({o.detector for o in observations}) > 1:
            warnings.append(
                "Blink contains different detectors; brightness changes can be spectral."
            )
    elif job.request.kind in (JobKind.stack, JobKind.difference):
        frames = [combine(frames, difference=job.request.kind == JobKind.difference)]
    images = preview_images(frames, difference=job.request.kind == JobKind.difference)
    artifacts = []

    def register(name: str, media_type: str):
        artifacts.append(
            Artifact(
                name=name, media_type=media_type, url=f"/api/v1/jobs/{job.id}/artifacts/{name}"
            )
        )

    for index, (frame, image) in enumerate(zip(frames, images, strict=True)):
        prefix = f"frame-{index:02d}" if job.request.kind == JobKind.blink else "result"
        (output / f"{prefix}.fits").write_bytes(
            fits_bytes(frame, synthetic, coverage_count=job.request.kind == JobKind.stack)
        )
        image.save(output / f"{prefix}.png")
        register(f"{prefix}.fits", "application/fits")
        register(f"{prefix}.png", "image/png")
    if job.request.kind == JobKind.blink:
        images[0].save(
            output / "blink.gif", save_all=True, append_images=images[1:], duration=500, loop=0
        )
        register("blink.gif", "image/gif")
    provenance = {
        "software_version": __version__,
        "job_id": job.id,
        "request": job.request.model_dump(mode="json"),
        "synthetic": synthetic,
        "observations_in_processing_order": [o.model_dump(mode="json") for o in observations],
        "units": {
            "image": frames[0].unit,
            "variance": "(MJy/sr)^2" if frames[0].has_quality else None,
        },
        "resampling": "nearest neighbour" if job.request.source == "neossat" else "bilinear",
        "grid": "ICRS TAN, north up, east left, requested angular span at tangent point",
        "preview": "Shared percentile/asinh stretch across blink frames; FITS keeps linear values",
        "operation": {
            "cutout": "bilinear WCS resampling",
            "stack": "inverse variance weighted mean",
            "difference": "science[1] minus reference[0]",
            "blink": "frames in ascending MJD order",
        }[job.request.kind],
        "coverage": "number of usable images"
        if job.request.kind == JobKind.stack
        else "sum of valid bilinear interpolation weights (0 to 1)",
        "warnings": warnings,
    }
    if job.request.source == "neossat":
        provenance["operation"] = "NEOSSat WCS cutout / chronological blink"
        provenance["coverage"] = "1 for a sampled finite pixel, otherwise 0"
        provenance["attribution_url"] = "https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/neossat/"
    (output / "provenance.json").write_text(
        json.dumps(provenance, indent=2, ensure_ascii=False, allow_nan=False), encoding="utf-8"
    )
    register("provenance.json", "application/json")
    return artifacts, warnings


async def process_job(job: Job, store: Store, provider: Provider, provider_name: str):
    observations = validate_observations(job.request, store, provider_name)
    frames = []
    for observation in observations:
        body = await provider.fetch(observation, job.request)
        align = align_neossat if job.request.source == "neossat" else align_fits
        frames.append(await asyncio.to_thread(align, body, job.request))
        del body
    # Attempt-specific directories avoid collisions with abandoned worker attempts.
    output = store.root / "artifacts" / job.id / str(job.attempts)
    return await asyncio.to_thread(render, job, observations, frames, output)
