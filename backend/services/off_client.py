"""Open Food Facts HTTP client with Redis cache (TTLCache fallback), token-bucket rate limiting, and retry logic.

Design decisions:
- RedisCache: tries Redis first; falls back silently to in-process TTLCache if Redis is unreachable.
  Values are JSON-serialised so the cache survives restarts and is shareable across gunicorn workers.
- TTLCache: lazy eviction on get(), no background thread. NOT thread-safe. Single-worker only.
  Kept as fallback when Redis is unavailable (e.g. local dev without Docker).
- TokenBucket: linear refill, checked before every upstream call. NOT thread-safe. Single-worker only.
- OpenFoodFactsClient: stateful (cache + buckets) — class is justified.
- One retry on 503 with 1s backoff. On second 503: raise OFFUpstreamError (search) or
  return sample fallback with 'sample-fallback' source tag (search endpoint only).
- 429 from OFF: read Retry-After, retry up to 2 times, then raise OFFUpstreamError.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

import requests

from backend.config import Config

logger = logging.getLogger("foodlens.backend")

# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class RateLimitExceeded(Exception):
    """Raised when our own token bucket is empty before calling OFF."""


class OFFUpstreamError(Exception):
    """Raised when OFF returns an unexpected error status we cannot recover from."""

    def __init__(self, status_code: int, message: str = "") -> None:
        super().__init__(message or f"OFF returned HTTP {status_code}")
        self.status_code = status_code


class OFFTimeoutError(Exception):
    """Raised when the request to OFF exceeds the configured timeout."""


# ---------------------------------------------------------------------------
# TTLCache
# ---------------------------------------------------------------------------


class TTLCache:
    """Process-local dict-backed TTL cache. Eviction is lazy on get().

    NOT thread-safe. Single-worker only.
    """

    def __init__(self, ttl_seconds: int) -> None:
        self._ttl = ttl_seconds
        # maps key -> (expires_at_monotonic, value)
        self._store: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if time.monotonic() >= expires_at:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (time.monotonic() + self._ttl, value)

    def _evict_expired(self) -> None:
        now = time.monotonic()
        expired = [k for k, (exp, _) in self._store.items() if exp <= now]
        for k in expired:
            self._store.pop(k, None)

    def __len__(self) -> int:
        return len(self._store)


# ---------------------------------------------------------------------------
# RedisCache
# ---------------------------------------------------------------------------


class RedisCache:
    """Redis-backed TTL cache with automatic fallback to TTLCache.

    Values are JSON-serialised, so they survive Redis restarts and are safe to share
    across gunicorn workers. Falls back to in-process TTLCache when Redis is unreachable
    (e.g. local dev without Docker) — logs a one-time warning and continues.
    """

    def __init__(self, redis_url: str, ttl_seconds: int) -> None:
        self._ttl = ttl_seconds
        self._redis = None
        self._fallback: TTLCache | None = None
        try:
            import redis as _redis_lib
            client = _redis_lib.from_url(redis_url, decode_responses=True, socket_connect_timeout=2)
            client.ping()
            self._redis = client
            logger.info("RedisCache connected to %s (TTL %ds)", redis_url, ttl_seconds)
        except Exception as exc:
            logger.warning("Redis unavailable (%s) — falling back to in-process TTLCache", exc)
            self._fallback = TTLCache(ttl_seconds)

    @property
    def backend(self) -> str:
        return "redis" if self._redis is not None else "memory"

    def get(self, key: str) -> Any | None:
        if self._redis is not None:
            raw = self._redis.get(key)
            return json.loads(raw) if raw is not None else None
        return self._fallback.get(key)  # type: ignore[union-attr]

    def set(self, key: str, value: Any) -> None:
        if self._redis is not None:
            self._redis.setex(key, self._ttl, json.dumps(value, default=str))
        else:
            self._fallback.set(key, value)  # type: ignore[union-attr]


# ---------------------------------------------------------------------------
# TokenBucket
# ---------------------------------------------------------------------------


class TokenBucket:
    """Linear token-bucket rate limiter.

    Tokens refill at ``capacity / 60`` per second up to ``capacity``.
    NOT thread-safe. Single-worker only.
    """

    def __init__(self, capacity: int, refill_per_minute: int) -> None:
        self._capacity = float(capacity)
        self._tokens = float(capacity)
        self._refill_rate = refill_per_minute / 60.0  # tokens per second
        self._last_refill = time.monotonic()

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(self._capacity, self._tokens + elapsed * self._refill_rate)
        self._last_refill = now

    def try_consume(self, tokens: int = 1) -> bool:
        """Consume ``tokens`` if available. Returns True on success, False if bucket empty."""
        self._refill()
        if self._tokens >= tokens:
            self._tokens -= tokens
            return True
        return False

    def time_until_available(self, tokens: int = 1) -> float:
        """Seconds until ``tokens`` tokens will be available."""
        self._refill()
        deficit = tokens - self._tokens
        if deficit <= 0:
            return 0.0
        return deficit / self._refill_rate


# ---------------------------------------------------------------------------
# OpenFoodFactsClient
# ---------------------------------------------------------------------------

# Minimal fallback sample for /search when OFF is fully unavailable
_SEARCH_SAMPLE_FALLBACK: list[dict] = [
    {
        "code": "5449000131805",
        "product_name": "Coca-Cola Zero Sugar",
        "brands": "Coca-Cola",
        "image_front_url": None,
        "nutriscore_grade": "c",
        "environmental_score_grade": None,
        "ecoscore_grade": "not-applicable",
        "nutrient_levels": {"fat": "low", "salt": "low", "saturated-fat": "low", "sugars": "low"},
        "nutriments": {
            "energy-kcal_100g": 0.2,
            "fat_100g": 0,
            "saturated-fat_100g": 0,
            "sugars_100g": 0,
            "salt_100g": 0.02,
            "fiber_100g": None,
            "proteins_100g": 0,
        },
        "categories_tags": ["en:beverages", "en:carbonated-drinks", "en:diet-cola-soft-drink"],
    }
]


class OpenFoodFactsClient:
    """HTTP client for the Open Food Facts API v2.

    Stateful (cache + token buckets) — class is justified.

    Rate limits (design §7):
    - /search bucket: 10 requests/min
    - /product/<barcode> bucket: 100 requests/min
    """

    SOURCE_LIVE = "live-off"
    SOURCE_CACHE = "cache"
    SOURCE_SAMPLE = "sample-fallback"

    def __init__(self, config: Config) -> None:
        self._config = config
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": config.off_user_agent})
        self._cache = RedisCache(config.redis_url, config.cache_ttl_seconds)
        self._buckets: dict[str, TokenBucket] = {
            "search": TokenBucket(config.rate_search_per_min, config.rate_search_per_min),
            "product": TokenBucket(config.rate_product_per_min, config.rate_product_per_min),
        }

    @property
    def cache_backend(self) -> str:
        """Returns 'redis' or 'memory' — useful for health checks."""
        return self._cache.backend

    def bucket_for_endpoint(self, endpoint: str) -> TokenBucket:
        """Return the token bucket for a given endpoint name (for Retry-After calculation)."""
        return self._buckets[endpoint]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_product(self, barcode: str) -> tuple[dict | None, str]:
        """Fetch a single product from OFF by barcode.

        Returns
        -------
        (raw_product, source_tag)
            raw_product is the OFF product dict or None when not found.
            source_tag is one of SOURCE_LIVE, SOURCE_CACHE.

        Raises
        ------
        RateLimitExceeded
            When our own token bucket is empty.
        OFFUpstreamError
            When OFF returns an unrecoverable error (including 404).
        OFFTimeoutError
            When the request exceeds the configured timeout.
        """
        if not self._buckets["product"].try_consume():
            raise RateLimitExceeded("product bucket empty")

        cache_key = f"product:{barcode}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            logger.debug("Cache hit for product %s", barcode)
            return cached, self.SOURCE_CACHE

        url = f"{self._config.off_base_url}/product/{barcode}"
        data = self._request_with_retry(url, endpoint="product")

        # OFF returns status=0 when product not found
        if data.get("status") == 0 or not data.get("product"):
            raise OFFUpstreamError(404, f"Product {barcode} not found in OFF")

        product = data["product"]
        self._cache.set(cache_key, product)
        return product, self.SOURCE_LIVE

    def search(
        self,
        query: str,
        category_tag: str | None = None,
        page_size: int = 20,
        page: int = 1,
    ) -> tuple[list[dict], str]:
        """Search OFF for products.

        Returns
        -------
        (products, source_tag)
            products is a list of raw OFF product dicts.
            source_tag is one of SOURCE_LIVE, SOURCE_CACHE, SOURCE_SAMPLE.

        Raises
        ------
        RateLimitExceeded
            When our own token bucket is empty.
        OFFUpstreamError
            When OFF returns an unrecoverable non-503 error.
        OFFTimeoutError
            When the request exceeds the configured timeout.
        """
        if not self._buckets["search"].try_consume():
            raise RateLimitExceeded("search bucket empty")

        cache_key = f"search:q={query}&cat={category_tag}&ps={page_size}&p={page}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            logger.debug("Cache hit for search '%s'", query)
            return cached, self.SOURCE_CACHE

        params: dict[str, str] = {
            "search_terms": query,
            "page_size": str(page_size),
            "page": str(page),
        }
        if category_tag:
            params["categories_tags"] = category_tag

        url = f"{self._config.off_base_url}/search"

        try:
            data = self._request_with_retry(url, params=params, endpoint="search")
        except OFFUpstreamError as exc:
            if exc.status_code == 503:
                logger.warning("OFF /search unavailable after retry — returning sample fallback")
                return _SEARCH_SAMPLE_FALLBACK, self.SOURCE_SAMPLE
            raise

        products = data.get("products") or []
        self._cache.set(cache_key, products)
        return products, self.SOURCE_LIVE

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _request_with_retry(
        self,
        url: str,
        params: dict[str, str] | None = None,
        endpoint: str = "product",
    ) -> dict:
        """Make a GET request to OFF with retry logic.

        - 503: retry once after 1s backoff. On second 503, raise OFFUpstreamError(503).
        - 429: read Retry-After (default 5s), retry up to 2 times. Then raise OFFUpstreamError(429).
        - Timeout: raise OFFTimeoutError.
        - Other non-2xx: raise OFFUpstreamError(status_code).
        """
        max_503_retries = 1
        max_429_retries = 2
        attempts_503 = 0
        attempts_429 = 0

        while True:
            try:
                resp = self._session.get(
                    url,
                    params=params,
                    timeout=self._config.off_timeout_seconds,
                )
            except requests.exceptions.Timeout:
                raise OFFTimeoutError(f"Request to {url} timed out after {self._config.off_timeout_seconds}s")
            except requests.exceptions.RequestException as exc:
                raise OFFUpstreamError(0, f"Request error: {exc}")

            if resp.status_code == 200:
                return resp.json()

            if resp.status_code == 503:
                attempts_503 += 1
                if attempts_503 <= max_503_retries:
                    logger.warning("OFF returned 503 (attempt %d) — retrying after 1s", attempts_503)
                    time.sleep(1)
                    continue
                raise OFFUpstreamError(503, "OFF returned 503 after retry")

            if resp.status_code == 429:
                attempts_429 += 1
                retry_after = int(resp.headers.get("Retry-After", "5"))
                if attempts_429 <= max_429_retries:
                    logger.warning(
                        "OFF returned 429 (attempt %d) — waiting %ds before retry",
                        attempts_429,
                        retry_after,
                    )
                    time.sleep(retry_after)
                    continue
                raise OFFUpstreamError(429, f"OFF returned 429 after {max_429_retries} retries")

            if resp.status_code == 404:
                raise OFFUpstreamError(404, f"OFF returned 404 for {url}")

            raise OFFUpstreamError(resp.status_code, f"OFF returned {resp.status_code}")
