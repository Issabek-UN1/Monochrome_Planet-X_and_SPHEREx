"""Live CADC discovery -> DataLink -> FITS -> NEOSSat blink. Not source detection."""

import asyncio
import json
from pathlib import Path
from uuid import uuid4

from spherex.config import Settings
from spherex.models import JobRequest, SkySearch
from spherex.providers.neossat import NEOSSatProvider
from spherex.storage import Store
from spherex.worker import run_once


async def main():
    root = Path("data/neossat-validation") / uuid4().hex
    settings = Settings(data_dir=root)
    provider = NEOSSatProvider(settings)
    query = SkySearch(
        source="neossat",
        ra=244.32768,
        dec=-16.46982,
        radius_deg=0.01,
        mjd_min=60900.49,
        mjd_max=60900.52,
        limit=10,
    )
    result = await provider.search(query)
    store = Store(root)
    store.save_search("neossat-live", result, 0)
    selected = []
    seen = set()
    for obs in result.observations:
        exposure = obs.obs_id.split("?")[1].split("/")[0]
        if exposure not in seen:
            selected.append(obs)
            seen.add(exposure)
    if len(selected) < 2:
        raise RuntimeError("Need two public NEOSSat exposures for the live blink check")
    job = store.enqueue(
        JobRequest(
            source="neossat",
            kind="blink",
            observation_ids=[o.id for o in selected[:2]],
            ra=query.ra,
            dec=query.dec,
            fov_deg=0.1,
            size_px=128,
            subtract_zodi=False,
            reject_flags=0,
        ),
        10,
    )
    await run_once(store, settings)
    job = store.job(job.id)
    (root / "report.json").write_text(job.model_dump_json(indent=2), encoding="utf8")
    print(
        json.dumps(
            {"status": job.status, "error": job.error, "report": str(root / "report.json")},
            indent=2,
        ),
        flush=True,
    )
    if job.status != "succeeded":
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
