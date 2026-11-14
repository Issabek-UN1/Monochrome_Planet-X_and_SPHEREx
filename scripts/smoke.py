"""End-to-end offline API + durable worker check, without a running server."""

import asyncio
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from spherex.api import create_app
from spherex.config import Settings
from spherex.worker import run_once

with tempfile.TemporaryDirectory() as directory:
    settings = Settings(provider="demo", data_dir=Path(directory))
    app = create_app(settings)
    with TestClient(app) as client:
        result = client.get("/api/v1/observations", params={"ra": 269.4521, "dec": 4.6934})
        result.raise_for_status()
        selected = [o["id"] for o in result.json()["observations"] if o["detector"] == 1]
        for kind in ["cutout", "stack", "difference", "blink"]:
            ids = selected[:1] if kind == "cutout" else selected[:2]
            response = client.post(
                "/api/v1/jobs",
                json={
                    "kind": kind,
                    "observation_ids": ids,
                    "ra": 269.4521,
                    "dec": 4.6934,
                },
            )
            response.raise_for_status()
            job_id = response.json()["id"]
            asyncio.run(run_once(app.state.store, settings))
            job = client.get(f"/api/v1/jobs/{job_id}").json()
            assert job["status"] == "succeeded", job
            for artifact in job["artifacts"]:
                client.get(artifact["url"]).raise_for_status()
            print(f"{kind}: OK ({len(job['artifacts'])} artifacts)")
