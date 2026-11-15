import subprocess
import sys

import pytest
from fastapi.testclient import TestClient

from spherex import deployment
from spherex.api import create_app as create_api_app
from spherex.web import create_app


def test_dashboard_preserves_api_and_does_not_expose_data(settings, tmp_path):
    static = tmp_path / "dist"
    static.mkdir()
    (static / "index.html").write_text("<html>Dashboard</html>", encoding="utf-8")
    (static / "asset.js").write_text("console.log('dashboard')", encoding="utf-8")
    (tmp_path / "private.txt").write_text("private", encoding="utf-8")
    app = create_app(settings, static_dir=static)
    assert app.openapi() == create_api_app(settings).openapi()
    with TestClient(app) as client:
        response = client.get("/?ra=10&dec=20")
        assert response.status_code == 200
        assert response.text == "<html>Dashboard</html>"
        assert response.headers["cache-control"] == "no-cache"
        assert "javascript" in client.get("/asset.js").headers["content-type"]
        assert client.get("/api/v1/capabilities").json()["synthetic"] is True
        assert client.get("/health/live").status_code == 200
        assert client.get("/health/ready").status_code == 503
        for path in ("/api/unknown", "/missing.js", "/data/spherex.sqlite3", "/%2e%2e/private.txt"):
            response = client.get(path)
            assert response.status_code == 404
            assert "Dashboard" not in response.text


def test_missing_build_fails_before_serving(settings, tmp_path):
    with pytest.raises(RuntimeError, match="Built dashboard missing"):
        create_app(settings, static_dir=tmp_path)


@pytest.mark.parametrize("exit_code", [0, 7])
def test_unexpected_child_exit_stops_other_service(monkeypatch, exit_code):
    children = []
    original_popen = subprocess.Popen

    def start(command):
        child = original_popen(command)
        children.append(child)
        return child

    monkeypatch.setattr(deployment.subprocess, "Popen", start)
    result = deployment.supervise(
        [
            [sys.executable, "-c", "import time; time.sleep(60)"],
            [sys.executable, "-c", f"raise SystemExit({exit_code})"],
        ],
        shutdown_seconds=3,
    )
    assert result == 1
    assert all(child.poll() is not None for child in children)


def test_partial_start_failure_cleans_up_worker(monkeypatch):
    children = []
    original_popen = subprocess.Popen

    def start(command):
        if children:
            raise OSError("Cannot start API")
        child = original_popen(command)
        children.append(child)
        return child

    monkeypatch.setattr(deployment.subprocess, "Popen", start)
    with pytest.raises(OSError, match="Cannot start API"):
        deployment.supervise(
            [[sys.executable, "-c", "import time; time.sleep(60)"], ["unavailable-api"]],
            shutdown_seconds=3,
        )
    assert all(child.poll() is not None for child in children)
