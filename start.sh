#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
export UV_CACHE_DIR="${UV_CACHE_DIR:-$PWD/.uv-cache}"
if ! command -v uv >/dev/null 2>&1; then
    echo "Install uv: https://docs.astral.sh/uv/" >&2
    exit 1
fi
if [[ "${SKIP_SYNC:-0}" == "1" ]]; then
    exec uv run --frozen --no-sync python scripts/run_dashboard.py
fi
exec uv run --frozen python scripts/run_dashboard.py
