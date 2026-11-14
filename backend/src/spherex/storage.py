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
            if version not in (0, 1):
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
                PRAGMA user_version=1;
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

    def enqueue(self, request: JobRequest, capacity: int) -> Job:
        job_id, now = uuid4().hex, time.time()
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            count = db.execute(
                "SELECT count(*) FROM jobs WHERE status IN ('queued','running')"
            ).fetchone()[0]
            if count >= capacity:
                raise QueueFull
            db.execute(
                "INSERT INTO jobs(id,status,request,created,updated) VALUES (?,?,?,?,?)",
                (job_id, "queued", request.model_dump_json(), now, now),
            )
        return self.job(job_id)

    def job(self, job_id: str) -> Job | None:
        with self.connection() as db:
            row = db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not row:
            return None
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
        now = time.time()
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute(
                """UPDATE jobs SET status=CASE WHEN attempts>=3 THEN 'failed'
                       ELSE 'queued' END, error='Worker lease expired', owner=NULL
                       WHERE status='running' AND lease_until<?""",
                (now,),
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

    def heartbeat(self, job_id: str, owner: str, lease_seconds: int):
        with self.connection() as db:
            db.execute(
                """UPDATE jobs SET lease_until=?, updated=?
                       WHERE id=? AND owner=? AND status='running'""",
                (time.time() + lease_seconds, time.time(), job_id, owner),
            )

    def finish(
        self,
        job_id: str,
        owner: str,
        artifacts: list[Artifact],
        warnings: list[str],
        error: str | None = None,
    ):
        with self.connection() as db:
            db.execute(
                """UPDATE jobs SET status=?, artifacts=?, warnings=?, error=?,
                       updated=?, owner=NULL, lease_until=NULL
                       WHERE id=? AND owner=? AND status='running'""",
                (
                    "failed" if error else "succeeded",
                    json.dumps([a.model_dump() for a in artifacts]),
                    json.dumps(warnings),
                    error,
                    time.time(),
                    job_id,
                    owner,
                ),
            )
