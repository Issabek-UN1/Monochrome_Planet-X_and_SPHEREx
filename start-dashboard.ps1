# Quick launch for Monochrome SPHEREx Dashboard and Backend
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  MONOCHROME SPHEREx: PLANET X DISCOVERY DASHBOARD" -ForegroundColor Cyan
Write-Host "  NASA Space Apps Challenge 2026" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Environment checks
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Error "uv is not installed. Please install uv: https://docs.astral.sh/uv/"
    exit 1
}

$npmCmd = "npm.cmd"
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        $npmCmd = "npm"
    } else {
        Write-Error "Node.js / npm is not installed. Please install Node: https://nodejs.org/"
        exit 1
    }
}

# 2. Check .env
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "[OK] Created .env (Synthetic Demo mode enabled)" -ForegroundColor Green
}

# 3. Sync Python & Frontend
Write-Host "[1/3] Syncing backend environment..." -ForegroundColor Yellow
uv sync --frozen

if (-not (Test-Path "frontend/node_modules")) {
    Write-Host "[2/3] Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location "$root/frontend"
    & $npmCmd install
    Set-Location $root
}

Write-Host "[3/3] Starting Backend API (port 8000), Worker, and Frontend (port 5173)..." -ForegroundColor Green
Write-Host "Dashboard will open at http://localhost:5173" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to terminate all services." -ForegroundColor Yellow

$apiProc = Start-Process -FilePath "uv" -ArgumentList "run uvicorn spherex.api:app --host 127.0.0.1 --port 8000" -PassThru -NoNewWindow
$workerProc = Start-Process -FilePath "uv" -ArgumentList "run spherex-worker" -PassThru -NoNewWindow

Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"

try {
    Set-Location "$root/frontend"
    & $npmCmd run dev -- --host 127.0.0.1 --port 5173
} finally {
    Write-Host "`nStopping backend services..." -ForegroundColor Yellow
    if ($apiProc -and -not $apiProc.HasExited) { Stop-Process -Id $apiProc.Id -Force -ErrorAction SilentlyContinue }
    if ($workerProc -and -not $workerProc.HasExited) { Stop-Process -Id $workerProc.Id -Force -ErrorAction SilentlyContinue }
    Write-Host "All services stopped." -ForegroundColor Green
}
