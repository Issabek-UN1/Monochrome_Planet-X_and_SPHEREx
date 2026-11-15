"""Check the actual website + worker over HTTP using explicitly synthetic data.

Run after building frontend: uv run python scripts/smoke_deployment.py.
Pass --url http://127.0.0.1:8000 to check an already running demo container.
Never use this probe against an IRSA/production instance: it requires demo explicitly.
"""

import argparse
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx


def wait_ready(client: httpx.Client, seconds: float = 45):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            if client.get("/health/ready").status_code == 200:
                return
        except httpx.TransportError:
            pass
        time.sleep(0.25)
    raise RuntimeError("API and worker did not become ready")


def probe(url: str):
    with httpx.Client(base_url=url, timeout=5) as client:
        wait_ready(client)
        capabilities = client.get("/api/v1/capabilities")
        capabilities.raise_for_status()
        assert capabilities.json()["synthetic"] is True, "Probe requires explicit demo provider"
        page = client.get("/")
        page.raise_for_status()
        assert '<div id="root">' in page.text
        assert "/assets/" in page.text
        for asset in re.findall(r'(?:src|href)="(/assets/[^\"]+)"', page.text):
            client.get(asset).raise_for_status()
        result = client.get("/api/v1/observations", params={"ra": 10, "dec": 20})
        result.raise_for_status()
        observation = result.json()["observations"][0]
        response = client.post(
            "/api/v1/jobs",
            json={"kind": "cutout", "observation_ids": [observation["id"]], "ra": 10, "dec": 20},
        )
        response.raise_for_status()
        job_id = response.json()["id"]
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            response = client.get(f"/api/v1/jobs/{job_id}")
            response.raise_for_status()
            job = response.json()
            assert job["status"] != "failed", job
            if job["status"] == "succeeded":
                assert job["artifacts"]
                for artifact in job["artifacts"]:
                    client.get(artifact["url"]).raise_for_status()
                print("Website + API + separate worker + artifact downloads: OK (synthetic)")
                return
            time.sleep(0.25)
        raise RuntimeError("Worker did not finish the synthetic job")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", help="Existing demo container URL; do not start local services")
    args = parser.parse_args()
    if args.url:
        probe(args.url)
        return
    root = Path(__file__).resolve().parents[1]
    assert (root / "frontend/dist/index.html").is_file(), "Run npm run build in frontend first"
    with tempfile.TemporaryDirectory() as directory:
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        env = {
            **os.environ,
            "SPHEREX_PROVIDER": "demo",
            "SPHEREX_DATA_DIR": directory,
            "SPHEREX_STATIC_DIR": str(root / "frontend/dist"),
        }
        children = []
        with tempfile.TemporaryFile(mode="w+b") as logs:
            try:
                for command in (
                    [sys.executable, "-m", "spherex.worker"],
                    [
                        sys.executable,
                        "-m",
                        "uvicorn",
                        "spherex.web:create_app",
                        "--factory",
                        "--host",
                        "127.0.0.1",
                        "--port",
                        str(port),
                    ],
                ):
                    children.append(
                        subprocess.Popen(command, env=env, cwd=root, stdout=logs, stderr=logs)
                    )
                probe(f"http://127.0.0.1:{port}")
            except Exception:
                logs.seek(0)
                print(logs.read().decode("utf-8", errors="replace"), file=sys.stderr)
                raise
            finally:
                for child in children:
                    if child.poll() is None:
                        child.terminate()
                for child in children:
                    try:
                        child.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        child.kill()
                        child.wait()


if __name__ == "__main__":
    main()
