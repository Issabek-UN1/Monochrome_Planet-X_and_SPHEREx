"""Serve the built dashboard and the existing API from one origin."""

import os
from pathlib import Path

from fastapi import FastAPI
from starlette.staticfiles import StaticFiles

from spherex.api import create_app as create_api_app
from spherex.config import Settings


class DashboardFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.headers.get("content-type", "").startswith("text/html"):
            response.headers["Cache-Control"] = "no-cache"
        return response


def create_app(settings: Settings | None = None, static_dir: Path | None = None) -> FastAPI:
    directory = static_dir or Path(os.environ.get("SPHEREX_STATIC_DIR", "frontend/dist"))
    if not (directory / "index.html").is_file():
        raise RuntimeError(f"Built dashboard missing in {directory}; run npm run build in frontend")
    app = create_api_app(settings)
    # Mount last: API, health, docs and artifact routes must keep their own handlers.
    # The UI uses query strings and hash navigation, so no catch-all HTML rewrite is needed.
    app.mount("/", DashboardFiles(directory=directory, html=True), name="dashboard")
    return app
