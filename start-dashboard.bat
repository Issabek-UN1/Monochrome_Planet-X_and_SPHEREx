@echo off
setlocal enabledelayedexpansion
title Monochrome SPHEREx - Dashboard & Backend

echo ========================================================
echo   MONOCHROME SPHEREx: PLANET X DISCOVERY DASHBOARD
echo   NASA Space Apps Challenge 2026
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Check uv
where uv >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] uv is not installed or not in PATH.
    echo Please install uv: https://docs.astral.sh/uv/
    pause
    exit /b 1
)

:: 2. Check npm
where npm.cmd >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    where npm >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Node.js / npm is not installed or not in PATH.
        echo Please install Node.js: https://nodejs.org/
        pause
        exit /b 1
    )
)

:: 3. Setup .env if missing
if not exist .env (
    copy .env.example .env >nul
    echo [OK] Created .env (Synthetic Demo mode enabled)
)

echo [1/3] Syncing backend environment...
call uv sync --frozen

:: 4. Install frontend dependencies if needed
if not exist "frontend\node_modules" (
    echo [2/3] Installing frontend dependencies...
    cd frontend
    call npm.cmd install
    cd ..
)

echo [3/3] Starting Backend API (port 8000), Worker, and Frontend Dashboard...
echo.
echo   - Backend API: http://127.0.0.1:8000
echo   - API Docs:    http://127.0.0.1:8000/docs
echo   - Dashboard:   http://localhost:5173
echo.
echo Press Ctrl+C in this window to stop all services.
echo ========================================================
echo.

:: Launch Backend API in background window
start "SPHEREx Backend API" /min cmd /c "uv run uvicorn spherex.api:app --host 127.0.0.1 --port 8000"

:: Launch Worker in background window
start "SPHEREx Worker" /min cmd /c "uv run spherex-worker"

:: Launch browser opening the Dashboard
start "" cmd /c "timeout /t 3 >nul & start http://localhost:5173"

:: Run Frontend in the foreground
cd frontend
call npm.cmd run dev -- --host 127.0.0.1 --port 5173
