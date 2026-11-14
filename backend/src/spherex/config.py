from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SPHEREX_", env_file=".env", extra="ignore")

    provider: Literal["irsa", "demo"] = "irsa"
    collections: list[str] = Field(
        default_factory=lambda: ["spherex_dr1", "spherex_qr3"], min_length=1
    )
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://localhost:5173"]
    )
    data_dir: Path = Path("data")
    search_ttl_seconds: int = Field(900, ge=0)
    http_timeout_seconds: float = Field(60, gt=0, le=300)
    max_download_bytes: int = Field(64 * 1024 * 1024, ge=1024)
    max_pending_jobs: int = Field(100, ge=1)
    lease_seconds: int = Field(1800, ge=60)
