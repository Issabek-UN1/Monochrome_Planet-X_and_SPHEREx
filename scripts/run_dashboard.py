"""Start API, worker and Vite as one supervised local application."""

import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def available(port):
    with socket.socket() as probe:
        if os.name != "nt":
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        probe.bind(("127.0.0.1", port))


def wait_ready(url, processes):
    deadline = time.monotonic() + 40
    while time.monotonic() < deadline:
        if any(p.poll() is not None for p in processes):
            raise RuntimeError("A service exited during startup; see output above")
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except (OSError, urllib.error.URLError):
            pass
        time.sleep(0.2)
    raise RuntimeError(f"Service did not become ready: {url}")


def main():
    os.chdir(ROOT)
    port = int(os.environ.get("PORT", "8000"))
    frontend_port = int(os.environ.get("FRONTEND_PORT", "5173"))
    if not all(1 <= n <= 65535 for n in (port, frontend_port)) or port == frontend_port:
        raise ValueError("Choose different API/frontend ports between 1 and 65535")
    for selected_port in (port, frontend_port):
        try:
            available(selected_port)
        except OSError as exc:
            raise RuntimeError(
                f"Port {selected_port} is busy; change PORT or FRONTEND_PORT"
            ) from exc
    if not (ROOT / ".env").exists():
        shutil.copyfile(ROOT / ".env.example", ROOT / ".env")
        print("Created .env from the real-archive configuration", flush=True)
    from spherex.config import Settings

    provider = Settings().provider
    print(
        "SPHEREx source: "
        + (
            "IRSA real archive" if provider == "irsa" else "SYNTHETIC DEMO (explicit configuration)"
        ),
        flush=True,
    )
    node = shutil.which("node")
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if os.name == "nt":
        node_dir = Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "nodejs"
        node = node or (str(node_dir / "node.exe") if (node_dir / "node.exe").exists() else None)
        npm = npm or (str(node_dir / "npm.cmd") if (node_dir / "npm.cmd").exists() else None)
    if not node or not npm:
        raise RuntimeError("Install Node.js and npm before starting the dashboard")
    env = os.environ.copy()
    env["VITE_API_PROXY_TARGET"] = f"http://127.0.0.1:{port}"
    env["PATH"] = str(Path(node).parent) + os.pathsep + env.get("PATH", "")
    hidden = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    if env.get("SKIP_SYNC") != "1":
        subprocess.run(
            [npm, "ci", "--include=dev"],
            cwd=ROOT / "frontend",
            env=env,
            check=True,
            creationflags=hidden,
        )
    vite = ROOT / "frontend/node_modules/vite/bin/vite.js"
    if not vite.exists():
        raise RuntimeError("Frontend dependencies missing; restart without SKIP_SYNC=1")
    processes = []
    try:
        commands = [
            [
                sys.executable,
                "-m",
                "uvicorn",
                "spherex.api:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
            ],
            [sys.executable, "-m", "spherex.worker"],
            [
                node,
                str(vite),
                str(ROOT / "frontend"),
                "--host",
                "127.0.0.1",
                "--port",
                str(frontend_port),
                "--strictPort",
            ],
        ]
        for command in commands:
            processes.append(subprocess.Popen(command, cwd=ROOT, env=env, creationflags=hidden))
        # Vite must load its configuration from the frontend project.
        # The frontend command receives its project root explicitly.
        wait_ready(f"http://127.0.0.1:{port}/health/ready", processes)
        url = f"http://127.0.0.1:{frontend_port}"
        wait_ready(url, processes)
        wait_ready(url + "/health/ready", processes)
        print(
            f"Dashboard: {url} | API: http://127.0.0.1:{port}/docs | Ctrl+C stops all services",
            flush=True,
        )
        if env.get("OPEN_BROWSER", "1") == "1":
            webbrowser.open(url)
        while all(p.poll() is None for p in processes):
            time.sleep(0.5)
        raise RuntimeError("A service stopped unexpectedly; shutting down the remaining services")
    finally:
        for process in processes:
            if process.poll() is None:
                if os.name == "nt":
                    # Windows venv python.exe can be a forwarding process with its own child.
                    # Stop only the tree rooted at a process started by this launcher.
                    subprocess.run(
                        ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=hidden,
                        check=False,
                    )
                else:
                    process.terminate()
        for process in processes:
            try:
                process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


def stop(_signum, _frame):
    raise KeyboardInterrupt


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, stop)
    try:
        main()
    except KeyboardInterrupt:
        print("Services stopped")
    except Exception as exc:
        print(f"Startup failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from None
