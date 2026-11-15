import json
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from spherex import __version__

DETECTOR_BANDS = [
    (0.75, 1.09),
    (1.10, 1.62),
    (1.63, 2.41),
    (2.42, 3.82),
    (3.83, 4.41),
    (4.42, 5.00),
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SPHEREX_", env_file=".env", extra="ignore")

    provider: Literal["irsa", "demo"] = "irsa"
    collections: list[str] = Field(
        default_factory=lambda: ["spherex_dr1", "spherex_qr3"], min_length=1
    )
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
        ]
    )
    data_dir: Path = Path("data")
    search_ttl_seconds: int = Field(900, ge=0)
    http_timeout_seconds: float = Field(120, gt=0, le=300)
    max_download_bytes: int = Field(64 * 1024 * 1024, ge=1024)
    max_cube_download_bytes: int = Field(384 * 1024 * 1024, ge=1024)
    max_pending_jobs: int = Field(100, ge=1)
    lease_seconds: int = Field(120, ge=60)

    job_timeout_seconds: float = Field(600, gt=0, le=3600)
    job_cache_ttl_seconds: int = Field(900, ge=0, le=86400)

    @property
    def queue_namespace(self) -> str:
        return json.dumps([__version__, self.provider, self.collections], sort_keys=True)
