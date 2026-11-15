"""Live validation of all five challenge fields. No external calls in offline CI.

uv run python scripts/verify_targets.py
Writes a report and exploratory blinks to data/target-validation (ignored by Git).
Checks image usability and temporal coverage, NOT identification/motion of a source.
"""

import argparse
import asyncio
import json
from pathlib import Path

from spherex.config import Settings
from spherex.models import JobRequest, SkySearch
from spherex.providers.irsa import IRSAProvider
from spherex.storage import Store
from spherex.targets import TARGETS
from spherex.worker import run_once


async def main(detector: int, radius_deg: float, fov_deg: float):
    root = Path("data/target-validation")
    settings = Settings(provider="irsa", data_dir=root)
    store = Store(root)
    provider = IRSAProvider(settings)
    report = {
        "provider": "irsa",
        "synthetic": False,
        "targets": [],
        "scope": "Sampled image usability and blink; no source detection or motion validation",
        "search_detector": detector,
        "search_radius_deg": radius_deg,
        "output_fov_deg": fov_deg,
    }
    for target in TARGETS:
        entry = {"target": target.model_dump(), "status": "failed"}
        try:
            query = SkySearch(
                ra=target.ra, dec=target.dec, radius_deg=radius_deg, detector=detector, limit=100
            )
            result = await provider.search(query)
            store.save_search(f"validation:{target.id}", result, 0)
            entry.update(
                records=len(result.observations), possibly_truncated=result.possibly_truncated
            )
            # Try up to three detector groups; retain the largest time separation in the sample.
            groups = []
            for detector_id in range(1, 7):
                group = sorted(
                    [
                        o
                        for o in result.observations
                        if o.detector == detector_id and o.mjd_start is not None
                    ],
                    key=lambda o: o.mjd_start,
                )
                if len(group) >= 2:
                    groups.append(
                        (group[-1].mjd_start - group[0].mjd_start, [group[0].id, group[-1].id])
                    )
            for delta, ids in sorted(groups, reverse=True)[:3]:
                if delta < 1:
                    continue
                request = JobRequest(
                    kind="blink",
                    observation_ids=ids,
                    ra=target.ra,
                    dec=target.dec,
                    fov_deg=fov_deg,
                    size_px=256,
                )
                job = store.enqueue(request, 100)
                await run_once(store, settings, provider)
                job = store.job(job.id)
                if job.status == "succeeded":
                    entry.update(
                        status="blink_created",
                        job_id=job.id,
                        sampled_epoch_separation_days=delta,
                        artifact_directory=str(root / "artifacts" / job.id / str(job.attempts)),
                    )
                    break
                entry["last_processing_error"] = job.error
            else:
                entry["reason"] = "No usable pair separated by at least one day in limited sample"
        except Exception as exc:
            entry["reason"] = str(exc)
        report["targets"].append(entry)
        (root / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"{target.name}: {entry['status']}", flush=True)
    print(f"Report: {root / 'report.json'}")
    if any(t["status"] != "blink_created" for t in report["targets"]):
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--detector", type=int, choices=range(1, 7), default=4)
    parser.add_argument("--radius-deg", type=float, default=0.001)
    parser.add_argument("--fov-deg", type=float, default=0.1)
    args = parser.parse_args()
    asyncio.run(main(args.detector, args.radius_deg, args.fov_deg))
