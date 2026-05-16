"""Backend configuration — load from environment, expose frozen Config dataclass.

All environment variables are documented in backend/.env.example.
No secrets are required for this project.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger("foodlens.backend")

_BACKEND_ROOT = Path(__file__).parent


@dataclass(frozen=True)
class Config:
    off_base_url: str
    off_user_agent: str
    off_timeout_seconds: float
    cache_ttl_seconds: int
    rate_search_per_min: int
    rate_product_per_min: int
    index_path: Path
    flask_host: str
    flask_port: int
    flask_env: str
    log_level: str
    redis_url: str
    telemetry_path: Path


def load_config(env_file: Path | None = None) -> Config:
    """Load configuration from .env file and environment variables.

    Environment variables always override .env file values.
    """
    if env_file is not None:
        load_dotenv(env_file, override=False)
    else:
        # Try backend/.env first, then repo-root .env
        candidate = _BACKEND_ROOT / ".env"
        if candidate.exists():
            load_dotenv(candidate, override=False)
        else:
            repo_root = _BACKEND_ROOT.parent
            root_candidate = repo_root / ".env"
            if root_candidate.exists():
                load_dotenv(root_candidate, override=False)

    index_path_raw = os.getenv("ALT_INDEX_PATH", str(_BACKEND_ROOT / "data" / "alt_index.pkl"))

    return Config(
        off_base_url=os.getenv("OFF_BASE_URL", "https://world.openfoodfacts.org/api/v2"),
        off_user_agent=os.getenv("OFF_USER_AGENT", "FoodLens-Backend/0.1 (team@uib.cat)"),
        off_timeout_seconds=float(os.getenv("OFF_TIMEOUT_SECONDS", "3")),
        cache_ttl_seconds=int(os.getenv("CACHE_TTL_SECONDS", "60")),
        rate_search_per_min=int(os.getenv("RATE_SEARCH_PER_MIN", "10")),
        rate_product_per_min=int(os.getenv("RATE_PRODUCT_PER_MIN", "100")),
        index_path=Path(index_path_raw),
        flask_host=os.getenv("FLASK_HOST", "0.0.0.0"),
        flask_port=int(os.getenv("FLASK_PORT", "5000")),
        flask_env=os.getenv("FLASK_ENV", "development"),
        log_level=os.getenv("BACKEND_LOG_LEVEL", "INFO"),
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        telemetry_path=Path(os.getenv("TELEMETRY_PATH", str(_BACKEND_ROOT / "data" / "telemetry.jsonl"))),
    )
