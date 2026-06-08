"""In-memory KNN index store.

Loads alt_index.pkl at boot, validates version, exposes query helpers.
Stateful (holds the full index in memory) — class is justified.

Design decisions:
- Scaler is stored as numeric arrays (scaler_params), NOT as a pickled sklearn object.
  Manual formula: x_scaled = x * scale + min, clamped to [0, 1]. (Design D5)
- Version mismatch raises IndexVersionError; server starts in degraded mode.
"""
from __future__ import annotations

import logging
import pickle
from pathlib import Path

import numpy as np

from backend.services.normaliser import slugify_tag

logger = logging.getLogger("foodlens.backend")

SUPPORTED_VERSION = 1


class IndexVersionError(Exception):
    """Raised when the index file has an unsupported version field."""


class IndexStore:
    """Load and query the prebuilt KNN alternative index.

    Parameters
    ----------
    index_path:
        Path to ``alt_index.pkl``. May not exist yet (degraded mode).
    """

    def __init__(self, index_path: Path) -> None:
        self._path = index_path
        self._loaded = False
        self._degraded_reason: str | None = None

        # Index contents (populated on load())
        self._version: int | None = None
        self._built_at: str | None = None
        self._builder_version: str | None = None
        self._nutrient_keys: list[str] = []
        self._scaler_params: dict | None = None
        self._products: list[dict] = []
        self._feature_matrix: np.ndarray | None = None
        self._category_index: dict[str, list[int]] = {}
        self._barcode_index: dict[str, int] = {}

    def load(self) -> None:
        """Load and validate the index from disk.

        Raises
        ------
        IndexVersionError
            When the pickle contains an unsupported version number.
        FileNotFoundError
            When the index file does not exist.
        """
        if not self._path.exists():
            raise FileNotFoundError(f"Index not found: {self._path}")

        with open(self._path, "rb") as fh:
            data: dict = pickle.load(fh)

        version = data.get("version")
        if version != SUPPORTED_VERSION:
            self._degraded_reason = "index_version_mismatch"
            raise IndexVersionError(
                f"Index version {version!r} is not supported (expected {SUPPORTED_VERSION}). "
                "Rebuild with scripts/build_knn_index.py."
            )

        self._version = version
        self._built_at = data.get("built_at")
        self._builder_version = data.get("builder_version", "unknown")
        self._nutrient_keys = data.get("nutrient_keys", [])
        self._scaler_params = data.get("scaler_params")
        self._products = data.get("products", [])
        self._feature_matrix = data.get("feature_matrix")
        self._category_index = data.get("category_index", {})
        self._barcode_index = data.get("barcode_index", {})
        self._loaded = True

        logger.info(
            "Index loaded: %d products, built_at=%s, version=%d",
            len(self._products),
            self._built_at,
            self._version,
        )

    # ------------------------------------------------------------------
    # State queries
    # ------------------------------------------------------------------

    def is_loaded(self) -> bool:
        """Return True when the index has been successfully loaded."""
        return self._loaded

    def built_at(self) -> str | None:
        """Return the ISO-8601 timestamp when the index was built."""
        return self._built_at

    def size(self) -> int:
        """Return the number of products in the index."""
        return len(self._products)

    # ------------------------------------------------------------------
    # Lookup helpers
    # ------------------------------------------------------------------

    def get_by_barcode(self, code: str) -> dict | None:
        """Return the normalised product dict for a barcode, or None."""
        idx = self._barcode_index.get(code)
        if idx is None:
            return None
        return self._products[idx]

    def filter_by_category(self, category: str) -> list[dict]:
        """Return all products in a category. Empty list (not an error) when category missing."""
        indices = self._category_index.get(slugify_tag(category), [])
        return [self._products[i] for i in indices]

    def category_count(self, category: str) -> int:
        """Return the number of products in a category (0 when category missing)."""
        return len(self._category_index.get(slugify_tag(category), []))

    def category_products(self, category: str, offset: int = 0, limit: int | None = None) -> list[dict]:
        """Return a (paginated) slice of a single category's products.

        Mirrors ``all_products`` but scoped to one OFF category tag. The tag is
        slugified internally (e.g. ``en:cheeses`` -> ``en:cheeses``), so the
        route can pass the raw chip tag. Products are already in the
        frontend-normalised camelCase shape — read-only references.

        Parameters
        ----------
        category:
            OFF category tag (slugified internally via ``slugify_tag``).
        offset:
            Start index into the category list (clamped to >= 0).
        limit:
            Maximum number of products to return; None returns the remainder.
        """
        if not self._loaded:
            return []
        indices = self._category_index.get(slugify_tag(category), [])
        start = max(offset, 0)
        if limit is None:
            sliced = indices[start:]
        else:
            sliced = indices[start : start + max(limit, 0)]
        return [self._products[i] for i in sliced]

    def all_products(self, offset: int = 0, limit: int | None = None) -> list[dict]:
        """Return a (paginated) slice of the full catalogue.

        Products are already in the frontend-normalised camelCase shape, so the
        route can hand them straight to the client. The slice references the
        stored dicts (read-only) — callers must not mutate them.

        Parameters
        ----------
        offset:
            Start index into the catalogue (clamped to >= 0 by the caller).
        limit:
            Maximum number of products to return; None returns the remainder.
        """
        if not self._loaded:
            return []
        start = max(offset, 0)
        if limit is None:
            return self._products[start:]
        return self._products[start : start + max(limit, 0)]

    # ------------------------------------------------------------------
    # Scaler helpers (manual application — no sklearn object in memory)
    # ------------------------------------------------------------------

    def scale_query(self, product: dict) -> np.ndarray:
        """Project a normalised product's nutrients into the scaled feature space.

        Applies MinMaxScaler formula: x_scaled = x * scale + min_, clamped to [0, 1].
        Missing nutrients (None) are imputed with 0.5 (mid-range).

        Parameters
        ----------
        product:
            A normalised product dict (output of normaliser.normalise_product).
        """
        if self._scaler_params is None or not self._nutrient_keys:
            return np.zeros(len(self._nutrient_keys))

        nutrients = product.get("nutrients", {})
        scale = np.array(self._scaler_params["scale"], dtype=float)
        min_ = np.array(self._scaler_params["min"], dtype=float)

        raw_values = []
        for key in self._nutrient_keys:
            v = nutrients.get(key)
            raw_values.append(float(v) if isinstance(v, (int, float)) and v is not None else None)

        # Impute None with 0.5 in scaled space
        result = np.empty(len(self._nutrient_keys))
        for i, v in enumerate(raw_values):
            if v is None:
                result[i] = 0.5
            else:
                result[i] = np.clip(v * scale[i] + min_[i], 0.0, 1.0)

        return result

    def scaled_pool(self, category: str) -> tuple[np.ndarray, list[dict]]:
        """Return the scaled feature matrix and product list for a category.

        Returns
        -------
        (matrix, products)
            matrix has shape (N, n_features); products is the corresponding list.
            Both are empty when the category is not in the index.
        """
        indices = self._category_index.get(slugify_tag(category), [])
        if not indices or self._feature_matrix is None:
            return np.empty((0, len(self._nutrient_keys))), []

        matrix = self._feature_matrix[indices]
        products = [self._products[i] for i in indices]
        return matrix, products
