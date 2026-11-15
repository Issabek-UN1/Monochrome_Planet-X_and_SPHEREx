$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw "Install uv: https://docs.astral.sh/uv/"
}
if (-not $env:UV_CACHE_DIR) { $env:UV_CACHE_DIR = Join-Path $PSScriptRoot '.uv-cache' }
if ($env:SKIP_SYNC -eq '1') {
    & uv run --frozen --no-sync python scripts/run_dashboard.py
} else {
    & uv run --frozen python scripts/run_dashboard.py
}
exit $LASTEXITCODE
