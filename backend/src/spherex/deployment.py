"""Run one API and one separate worker on hosts with a single persistent disk."""

import logging
import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

from spherex.config import Settings
from spherex.storage import Store

logger = logging.getLogger(__name__)


def supervise(commands: list[list[str]], shutdown_seconds: float = 20) -> int:
    stopping = threading.Event()
    children: list[subprocess.Popen] = []
    previous_handlers = {}

    def stop(signum, frame):
        stopping.set()

    try:
        for signum in (signal.SIGTERM, signal.SIGINT):
            previous_handlers[signum] = signal.signal(signum, stop)
        for command in commands:
            if stopping.is_set():
                return 0
            children.append(subprocess.Popen(command))
        while not stopping.wait(0.2):
            for child in children:
                code = child.poll()
                if code is not None:
                    logger.error("Service pid=%s exited (%s); stopping deployment", child.pid, code)
                    return 1  # Even an unexpected clean exit must trigger a host restart.
        return 0
    finally:
        for child in children:
            if child.poll() is None:
                try:
                    # asyncio.run cancels worker tasks on SIGINT, releasing their leases.
                    if os.name == "posix":
                        child.send_signal(signal.SIGINT)
                    else:
                        child.terminate()
                except ProcessLookupError:
                    pass
        deadline = time.monotonic() + shutdown_seconds
        for child in children:
            try:
                child.wait(timeout=max(0, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
        for signum, handler in previous_handlers.items():
            signal.signal(signum, handler)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    port = int(os.environ.get("PORT", "8000"))
    if not 1 <= port <= 65535:
        raise ValueError("PORT must be between 1 and 65535")
    directory = Path(os.environ.get("SPHEREX_STATIC_DIR", "frontend/dist"))
    if not (directory / "index.html").is_file():
        raise RuntimeError(f"Built dashboard missing in {directory}")
    settings = Settings()
    # Initialize/migrate SQLite before the two child processes open the same database.
    Store(settings.data_dir)
    logger.info(
        "Starting website; port=%s provider=%s data=%s", port, settings.provider, settings.data_dir
    )
    return supervise(
        [
            [sys.executable, "-m", "spherex.worker"],
            [
                sys.executable,
                "-m",
                "uvicorn",
                "spherex.web:create_app",
                "--factory",
                "--host",
                "0.0.0.0",
                "--port",
                str(port),
                "--timeout-graceful-shutdown",
                "15",
            ],
        ]
    )


if __name__ == "__main__":
    sys.exit(main())
