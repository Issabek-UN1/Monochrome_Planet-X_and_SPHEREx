#!/usr/bin/env bash
# Quick local launch: bash start.sh
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PORT="${PORT:-8000}"
OPEN_BROWSER="${OPEN_BROWSER:-1}"
SKIP_SYNC="${SKIP_SYNC:-0}"
export UV_CACHE_DIR="${UV_CACHE_DIR:-$ROOT/.uv-cache}"

if [[ ! "$PORT" =~ ^[0-9]{1,5}$ ]] || ((10#$PORT < 1 || 10#$PORT > 65535)); then
    echo "Ошибка: PORT должен быть числом от 1 до 65535." >&2
    exit 1
fi
PORT="$((10#$PORT))"

if ! command -v uv >/dev/null 2>&1; then
    echo "Установите uv: https://docs.astral.sh/uv/getting-started/installation/" >&2
    exit 1
fi

if [[ ! -f .env ]]; then
    cp .env.example .env
    echo "Создан .env: включён режим синтетических демонстрационных данных."
fi

if [[ "$SKIP_SYNC" != "1" ]]; then
    echo "Подготовка окружения…"
    uv sync --frozen
fi

if [[ -x .venv/Scripts/python.exe ]]; then
    PYTHON="$ROOT/.venv/Scripts/python.exe"
elif [[ -x .venv/bin/python ]]; then
    PYTHON="$ROOT/.venv/bin/python"
else
    echo "Окружение не найдено. Выполните uv sync --frozen." >&2
    exit 1
fi

# Fail before starting either service if another application already owns the port.
"$PYTHON" - "$PORT" <<'PY'
import socket
import sys

with socket.socket() as probe:
    try:
        probe.bind(("127.0.0.1", int(sys.argv[1])))
    except OSError:
        sys.exit(f"Порт {sys.argv[1]} занят. Запустите с PORT=8001 bash start.sh")
PY

api_pid=""
worker_pid=""
cleanup() {
    trap - EXIT INT TERM
    for pid in "$api_pid" "$worker_pid"; do
        if [[ -n "$pid" ]]; then
            kill "$pid" 2>/dev/null || true
        fi
    done
    for pid in "$api_pid" "$worker_pid"; do
        if [[ -n "$pid" ]]; then
            wait "$pid" 2>/dev/null || true
        fi
    done
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

"$PYTHON" -m uvicorn spherex.api:app --host 127.0.0.1 --port "$PORT" &
api_pid=$!
"$PYTHON" -m spherex.worker &
worker_pid=$!

"$PYTHON" - "$PORT" <<'PY'
import sys
import time
import urllib.error
import urllib.request

url = f"http://127.0.0.1:{sys.argv[1]}/health/ready"
for _ in range(60):
    try:
        with urllib.request.urlopen(url, timeout=1) as response:
            if response.status == 200:
                break
    except (OSError, urllib.error.URLError):
        pass
    time.sleep(0.25)
else:
    sys.exit("Не удалось запустить API. Проверьте сообщения выше.")
PY

if ! kill -0 "$api_pid" 2>/dev/null || ! kill -0 "$worker_pid" 2>/dev/null; then
    echo "Один из сервисов завершился. Проверьте сообщения выше." >&2
    exit 1
fi

URL="http://127.0.0.1:$PORT/docs"
echo
echo "Панель API: $URL"
echo "API и обработчик задач запущены. Для остановки нажмите Ctrl+C."
echo "Дизайнерский дашборд подключается отдельно; сейчас открывается Swagger."

if [[ "$OPEN_BROWSER" == "1" ]]; then
    "$PYTHON" - "$URL" <<'PY' || true
import sys
import webbrowser

webbrowser.open(sys.argv[1])
PY
fi

while kill -0 "$api_pid" 2>/dev/null && kill -0 "$worker_pid" 2>/dev/null; do
    sleep 1
done
echo "Один из сервисов остановился; завершаю второй." >&2
exit 1
