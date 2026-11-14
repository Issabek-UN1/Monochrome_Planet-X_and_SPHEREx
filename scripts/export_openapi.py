"""Run with `uv run python scripts/export_openapi.py` from the repository root."""

import json
from pathlib import Path

from spherex.api import create_app
from spherex.config import Settings

target = Path(__file__).resolve().parents[1] / "docs" / "openapi.json"
target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps(create_app(Settings()).openapi(), indent=2) + "\n", encoding="utf-8")
print(target)
