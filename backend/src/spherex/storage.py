import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

from spherex.errors import QueueFull
from spherex.models import Artifact, Job, JobRequest, Observation, SearchResult


class Store:
    """Shared SQLite metadata and durable queue; each operation owns its connection."""

    def __init__(self, root: Path):
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.path = self.root / "spherex.sqlite3"
        with self.connection() as db:
            db.execute("PRAGMA journal_mode=WAL")
            version = db.execute("PRAGMA user_version").fetchone()[0]
            if version not in (0, 1, 2):
                raise RuntimeError("Unsupported database schema; migration required")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS observations (
                    id TEXT PRIMARY KEY, body TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS searches (
                    key TEXT PRIMARY KEY, expires REAL NOT NULL, body TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY, status TEXT NOT NULL, request TEXT NOT NULL,
                    created REAL NOT NULL, updated REAL NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0, owner TEXT,
                    lease_until REAL, artifacts TEXT NOT NULL DEFAULT '[]',
                    warnings TEXT NOT NULL DEFAULT '[]', error TEXT
                );
                CREATE INDEX IF NOT EXISTS jobs_queue ON jobs(status, created);
                CREATE TABLE IF NOT EXISTS job_context (
                    job_id TEXT PRIMARY KEY, namespace TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS workers (
                    owner TEXT PRIMARY KEY, namespace TEXT NOT NULL, updated REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS jobs_request ON jobs(request, status, updated);
                PRAGMA user_version=2;
            """)

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def save_search(self, key: str, result: SearchResult, ttl: int):
        with self.connection() as db:
            db.executemany(
                "INSERT OR REPLACE INTO observations VALUES (?, ?)",
                [(o.id, o.model_dump_json()) for o in result.observations],
            )
            db.execute("DELETE FROM searches WHERE expires < ?", (time.time(),))
            db.execute(
                "INSERT OR REPLACE INTO searches VALUES (?, ?, ?)",
                (key, time.time() + ttl, result.model_dump_json()),
            )

    def cached_search(self, key: str) -> SearchResult | None:
        with self.connection() as db:
            row = db.execute(
                "SELECT body FROM searches WHERE key=? AND expires>?", (key, time.time())
            ).fetchone()
        if row:
            return SearchResult.model_validate_json(row[0]).model_copy(update={"cached": True})
        return None

    def observation(self, obs_id: str) -> Observation | None:
        with self.connection() as db:
            row = db.execute("SELECT body FROM observations WHERE id=?", (obs_id,)).fetchone()
        return Observation.model_validate_json(row[0]) if row else None

    def enqueue(self, request: JobRequest, capacity: int, *, namespace="", cache_ttl=0) -> Job:
        job_id, now = uuid4().hex, time.time()
        body = request.model_dump_json()
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            matches = db.execute(
                """SELECT j.* FROM jobs j JOIN job_context c ON c.job_id=j.id
                   WHERE j.request=? AND c.namespace=? AND
                   (j.status IN ('queued','running') OR (j.status='succeeded' AND j.updated>?))
                   ORDER BY j.created DESC""",
                (body, namespace, now - cache_ttl),
            ).fetchall()
            for row in matches:
                artifacts = json.loads(row["artifacts"])
                if row["status"] in ("queued", "running") or (
                    cache_ttl > 0
                    and artifacts
                    and all(
                        (
                            self.root / "artifacts" / row["id"] / str(row["attempts"]) / a["name"]
                        ).is_file()
                        for a in artifacts
                    )
                ):
                    return self._job(row)
            count = db.execute(
                "SELECT count(*) FROM jobs WHERE status IN ('queued','running')"
            ).fetchone()[0]
            if count >= capacity:
                raise QueueFull
            db.execute(
                "INSERT INTO jobs(id,status,request,created,updated) VALUES (?,?,?,?,?)",
                (job_id, "queued", body, now, now),
            )
            db.execute("INSERT INTO job_context VALUES (?,?)", (job_id, namespace))
        return self.job(job_id)

    def job(self, job_id: str) -> Job | None:
        with self.connection() as db:
            row = db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not row:
            return None
        return self._job(row)

    @staticmethod
    def _job(row: sqlite3.Row) -> Job:
        return Job(
            id=row["id"],
            status=row["status"],
            request=JobRequest.model_validate_json(row["request"]),
            created_at=row["created"],
            updated_at=row["updated"],
            attempts=row["attempts"],
            artifacts=json.loads(row["artifacts"]),
            warnings=json.loads(row["warnings"]),
            error=row["error"],
        )

    def claim(self, owner: str, lease_seconds: int) -> Job | None:
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            now = time.time()
            db.execute(
                """UPDATE jobs SET status=CASE WHEN attempts>=3 THEN 'failed'
                       ELSE 'queued' END, error='Worker lease expired', owner=NULL,
                       lease_until=NULL, updated=? WHERE status='running' AND lease_until<?""",
                (now, now),
            )
            row = db.execute(
                "SELECT id FROM jobs WHERE status='queued' ORDER BY created LIMIT 1"
            ).fetchone()
            if row is None:
                return None
            db.execute(
                """UPDATE jobs SET status='running', owner=?, lease_until=?,
                       updated=?, attempts=attempts+1, error=NULL WHERE id=?""",
                (owner, now + lease_seconds, now, row[0]),
            )
        return self.job(row[0])

    def heartbeat(self, job_id: str, owner: str, lease_seconds: int) -> bool:
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            now = time.time()
            changed = db.execute(
                """UPDATE jobs SET lease_until=?, updated=?
                       WHERE id=? AND owner=? AND status='running' AND lease_until>?""",
                (now + lease_seconds, now, job_id, owner, now),
            )
            return changed.rowcount == 1

    def finish(
        self,
        job_id: str,
        owner: str,
        artifacts: list[Artifact],
        warnings: list[str],
        error: str | None = None,
    ) -> bool:
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            now = time.time()
            changed = db.execute(
                """UPDATE jobs SET status=?, artifacts=?, warnings=?, error=?,
                       updated=?, owner=NULL, lease_until=NULL
                       WHERE id=? AND owner=? AND status='running' AND lease_until>?""",
                (
                    "failed" if error else "succeeded",
                    json.dumps([a.model_dump() for a in artifacts]),
                    json.dumps(warnings),
                    error,
                    now,
                    job_id,
                    owner,
                    now,
                ),
            )
            return changed.rowcount == 1

    def release(self, job_id: str, owner: str):
        """A graceful shutdown requeues its own attempt immediately."""
        with self.connection() as db:
            db.execute(
                """UPDATE jobs SET status='queued', owner=NULL, lease_until=NULL, updated=?
                   WHERE id=? AND owner=? AND status='running'""",
                (time.time(), job_id, owner),
            )

    def worker_ping(self, owner: str, namespace: str):
        with self.connection() as db:
            db.execute(
                "INSERT OR REPLACE INTO workers VALUES (?,?,?)", (owner, namespace, time.time())
            )
            db.execute("DELETE FROM workers WHERE updated<?", (time.time() - 120,))

    def worker_remove(self, owner: str):
        with self.connection() as db:
            db.execute("DELETE FROM workers WHERE owner=?", (owner,))

    def worker_available(self, namespace: str) -> bool:
        with self.connection() as db:
            return (
                db.execute(
                    "SELECT 1 FROM workers WHERE namespace=? AND updated>? LIMIT 1",
                    (namespace, time.time() - 30),
                ).fetchone()
                is not None
            )
