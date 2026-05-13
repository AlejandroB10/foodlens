"""Offline KNN index builder for FoodLens alternatives engine.

Fetches products from OFF /search paged across configured category tags,
fits a MinMaxScaler over the 7 nutrient features, and serialises the result
as alt_index.pkl (pickle protocol 4).

Usage:
    python -m backend.scripts.build_knn_index --output backend/data/alt_index.pkl
    python backend/scripts/build_knn_index.py --output backend/data/alt_index.pkl

Design decisions:
- Scaler stored as numeric arrays (NOT pickled sklearn object). See Design D5.
- _generate_synthetic_pool() is COPIED from notebooks/OFF_ML_Demo.ipynb. See Design D6.
  # Source: notebooks/OFF_ML_Demo.ipynb — keep in sync
"""
from __future__ import annotations

import argparse
import datetime
import logging
import pickle
import sys
import time
from pathlib import Path
from typing import Any, TypedDict

import numpy as np
import requests
from sklearn.preprocessing import MinMaxScaler

# Allow running as python backend/scripts/build_knn_index.py from repo root
_REPO_ROOT = Path(__file__).parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from backend.services.normaliser import normalise_product

logger = logging.getLogger("foodlens.backend.build_index")

VERSION = 1
BUILDER_VERSION = "0.1.0"

NUTRIENT_KEYS: list[str] = [
    "sugars_100g",
    "fat_100g",
    "saturatedFat_100g",
    "salt_100g",
    "proteins_100g",
    "fiber_100g",
    "energyKcal_100g",
]

DEFAULT_CATEGORIES: list[str] = [
    "en:yogurts",
    "en:breakfast-cereals",
    "en:soft-drinks",
    "en:biscuits-and-cakes",
    "en:breads",
    "en:cheeses",
    "en:chips-and-fries",
    "en:chocolates",
    "en:fruit-juices",
    "en:pasta",
]

OFF_BASE_URL = "https://world.openfoodfacts.org/api/v2"
OFF_USER_AGENT = "FoodLens-Backend/0.1 (team@uib.cat)"

OFF_PRODUCT_FIELDS = ",".join([
    "code",
    "product_name",
    "brands",
    "image_front_url",
    "nutriscore_grade",
    "environmental_score_grade",
    "ecoscore_grade",
    "nutrient_levels",
    "nutriments",
    "categories_tags",
])


# ---------------------------------------------------------------------------
# TypedDicts for the index format
# ---------------------------------------------------------------------------


class ScalerParams(TypedDict):
    data_min: list[float]
    data_max: list[float]
    scale: list[float]
    min: list[float]
    feature_range: tuple[float, float]


class AltIndex(TypedDict):
    version: int
    built_at: str
    builder_version: str
    nutrient_keys: list[str]
    scaler_params: ScalerParams
    products: list[dict]
    feature_matrix: np.ndarray
    category_index: dict[str, list[int]]
    barcode_index: dict[str, int]
    source_counts: dict[str, int]


# ---------------------------------------------------------------------------
# Synthetic fallback pool
# Source: notebooks/OFF_ML_Demo.ipynb — keep in sync
# ---------------------------------------------------------------------------


def _generate_synthetic_pool() -> list[dict]:
    """Generate synthetic OFF-like product records covering all Nutri-Score grades.

    Adapted from the per-grade nutrient profiles in notebooks/OFF_ML_Demo.ipynb.
    Used as a fallback when OFF /search returns 503 during index build.

    # Source: notebooks/OFF_ML_Demo.ipynb — keep in sync
    """
    rng = np.random.default_rng(42)

    # Per-grade mean nutrient profiles (sugars, fat, sat_fat, salt, proteins, fiber, kcal)
    grade_profiles: dict[str, dict[str, Any]] = {
        "a": {
            "sugars_100g": (3.0, 1.5),
            "fat_100g": (2.0, 1.0),
            "saturatedFat_100g": (0.5, 0.3),
            "salt_100g": (0.1, 0.05),
            "proteins_100g": (10.0, 3.0),
            "fiber_100g": (6.0, 2.0),
            "energyKcal_100g": (80.0, 20.0),
        },
        "b": {
            "sugars_100g": (8.0, 3.0),
            "fat_100g": (5.0, 2.0),
            "saturatedFat_100g": (1.5, 0.7),
            "salt_100g": (0.3, 0.15),
            "proteins_100g": (8.0, 2.5),
            "fiber_100g": (4.0, 1.5),
            "energyKcal_100g": (150.0, 40.0),
        },
        "c": {
            "sugars_100g": (15.0, 5.0),
            "fat_100g": (10.0, 4.0),
            "saturatedFat_100g": (3.0, 1.0),
            "salt_100g": (0.5, 0.2),
            "proteins_100g": (5.0, 2.0),
            "fiber_100g": (2.0, 1.0),
            "energyKcal_100g": (230.0, 50.0),
        },
        "d": {
            "sugars_100g": (25.0, 7.0),
            "fat_100g": (18.0, 5.0),
            "saturatedFat_100g": (6.0, 2.0),
            "salt_100g": (0.9, 0.3),
            "proteins_100g": (4.0, 1.5),
            "fiber_100g": (1.0, 0.5),
            "energyKcal_100g": (380.0, 70.0),
        },
        "e": {
            "sugars_100g": (40.0, 10.0),
            "fat_100g": (28.0, 7.0),
            "saturatedFat_100g": (12.0, 3.0),
            "salt_100g": (1.2, 0.4),
            "proteins_100g": (5.0, 2.0),
            "fiber_100g": (0.5, 0.3),
            "energyKcal_100g": (520.0, 80.0),
        },
    }

    categories = [
        "en:yogurts",
        "en:breakfast-cereals",
        "en:soft-drinks",
        "en:biscuits-and-cakes",
        "en:breads",
        "en:cheeses",
        "en:chips-and-fries",
        "en:chocolates",
    ]

    eco_grades = ["a", "b", "c", "d", "e", "unknown"]
    products: list[dict] = []
    barcode_counter = 1000000000000

    for grade, profile in grade_profiles.items():
        for i in range(40):  # 40 products per grade = 200 total
            nutrients: dict[str, float | None] = {}
            for nutrient_key, (mean, std) in profile.items():
                val = float(rng.normal(mean, std))
                nutrients[nutrient_key] = max(0.0, round(val, 2))

            category = categories[i % len(categories)]
            eco_grade = eco_grades[i % len(eco_grades)]
            barcode = str(barcode_counter + len(products))

            product: dict = {
                "source": "synthetic",
                "code": barcode,
                "name": f"Synthetic {grade.upper()} product {i + 1}",
                "brands": ["SyntheticBrand"],
                "image": None,
                "category": category,
                "nutriScore": {"grade": grade, "numeric": {"a": 5, "b": 4, "c": 3, "d": 2, "e": 1}[grade]},
                "ecoScore": {
                    "grade": eco_grade,
                    "numeric": {"a": 5, "b": 4, "c": 3, "d": 2, "e": 1}.get(eco_grade),
                    "sourceField": "environmental_score_grade" if eco_grade != "unknown" else None,
                },
                "nutrientLevels": {
                    "fat": _level(nutrients.get("fat_100g", 0)),
                    "salt": _level(nutrients.get("salt_100g", 0)),
                    "saturatedFat": _level(nutrients.get("saturatedFat_100g", 0)),
                    "sugars": _level(nutrients.get("sugars_100g", 0)),
                },
                "nutrients": nutrients,
            }
            products.append(product)

    return products


def _level(v: float | None) -> str:
    """Map a raw gram value to low/moderate/high (rough thresholds)."""
    if v is None or v < 3:
        return "low"
    if v < 10:
        return "moderate"
    return "high"


# ---------------------------------------------------------------------------
# Index build pipeline
# ---------------------------------------------------------------------------


def _fetch_products_for_category(
    category: str,
    pages: int,
    session: requests.Session,
) -> tuple[list[dict], bool]:
    """Fetch raw OFF products for one category across multiple pages.

    Returns (products, had_503). had_503=True means OFF returned 503 at least once.
    On 503, stops fetching further pages (caller decides fallback).
    """
    products: list[dict] = []
    had_503 = False

    for page in range(1, pages + 1):
        params = {
            "categories_tags": category,
            "fields": OFF_PRODUCT_FIELDS,
            "page_size": "50",
            "page": str(page),
        }
        try:
            resp = session.get(f"{OFF_BASE_URL}/search", params=params, timeout=10)
        except requests.exceptions.RequestException as exc:
            logger.warning("Network error fetching category %s page %d: %s", category, page, exc)
            had_503 = True
            break

        if resp.status_code == 503:
            logger.warning("OFF returned 503 for category %s page %d", category, page)
            had_503 = True
            break

        if resp.status_code != 200:
            logger.warning("OFF returned %d for category %s page %d", resp.status_code, category, page)
            break

        data = resp.json()
        batch = data.get("products") or []
        products.extend(batch)
        logger.debug("Category %s page %d: %d products", category, page, len(batch))

        if len(batch) < 50:
            break  # last page

        time.sleep(0.5)  # polite rate limiting

    return products, had_503


def _drop_and_impute(
    products: list[dict],
    nutrient_keys: list[str],
    max_missing: int = 2,
) -> list[dict]:
    """Drop products missing more than max_missing nutrient keys; impute the rest with category median."""
    # Step 1: drop products with too many missing nutrients
    kept: list[dict] = []
    for p in products:
        nutrients = p.get("nutrients") or {}
        missing = sum(1 for k in nutrient_keys if nutrients.get(k) is None)
        if missing <= max_missing:
            kept.append(p)

    logger.info("After dropping: %d / %d products retained", len(kept), len(products))

    if not kept:
        return kept

    # Step 2: impute remaining Nones with global median per nutrient key
    for key in nutrient_keys:
        values = [
            p["nutrients"][key]
            for p in kept
            if p.get("nutrients", {}).get(key) is not None
        ]
        if not values:
            median_val = 0.0
        else:
            median_val = float(np.median(values))

        for p in kept:
            if p.get("nutrients", {}).get(key) is None:
                p.setdefault("nutrients", {})[key] = median_val

    return kept


def _build_feature_matrix(products: list[dict], nutrient_keys: list[str]) -> np.ndarray:
    """Build a raw (unscaled) feature matrix from normalised product dicts."""
    rows = []
    for p in products:
        nutrients = p.get("nutrients") or {}
        row = [float(nutrients.get(k) or 0.0) for k in nutrient_keys]
        rows.append(row)
    return np.array(rows, dtype=float)


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(
        stream=sys.stdout,
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )

    parser = argparse.ArgumentParser(description="Build FoodLens KNN alternative index")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("backend/data/alt_index.pkl"),
        help="Output path for alt_index.pkl",
    )
    parser.add_argument(
        "--categories",
        type=str,
        default=",".join(DEFAULT_CATEGORIES),
        help="Comma-separated list of OFF category tags to fetch",
    )
    parser.add_argument(
        "--pages-per-category",
        type=int,
        default=2,
        dest="pages_per_category",
        help="Number of pages to fetch per category (50 products/page)",
    )
    parser.add_argument(
        "--synthetic-fallback",
        action="store_true",
        dest="synthetic_fallback",
        help="Force synthetic pool instead of fetching from OFF",
    )
    parser.add_argument(
        "--min-products",
        type=int,
        default=200,
        dest="min_products",
        help="Minimum products required; uses synthetic pool if not reached",
    )
    args = parser.parse_args(argv)

    output_path: Path = args.output
    categories: list[str] = [c.strip() for c in args.categories.split(",") if c.strip()]

    # Step 1: fetch products
    use_synthetic = args.synthetic_fallback
    raw_products: list[dict] = []
    source_counts: dict[str, int] = {"off_api": 0, "synthetic": 0}

    if not use_synthetic:
        session = requests.Session()
        session.headers["User-Agent"] = OFF_USER_AGENT

        for category in categories:
            logger.info("Fetching category: %s", category)
            batch, had_503 = _fetch_products_for_category(
                category, args.pages_per_category, session
            )
            raw_products.extend(batch)
            if had_503:
                logger.warning("503 encountered — will use synthetic fallback")
                use_synthetic = True
                break

        source_counts["off_api"] = len(raw_products)

    if use_synthetic or len(raw_products) < args.min_products:
        if not use_synthetic:
            logger.warning(
                "Only %d products fetched (min %d) — switching to synthetic fallback",
                len(raw_products),
                args.min_products,
            )
        logger.info("Using synthetic product pool")
        synthetic = _generate_synthetic_pool()
        raw_products = synthetic
        source_counts["synthetic"] = len(synthetic)
        source_counts["off_api"] = 0
    else:
        # Normalise OFF products
        normalised_raw: list[dict] = []
        for raw in raw_products:
            norm = normalise_product(raw)
            if norm is not None:
                normalised_raw.append(norm)
        raw_products = normalised_raw

    logger.info("Total products before imputation: %d", len(raw_products))

    # Step 2: drop / impute
    products = _drop_and_impute(raw_products, NUTRIENT_KEYS)

    if len(products) < 10:
        logger.error("Too few products (%d) to build a useful index. Aborting.", len(products))
        return 1

    # Step 3: build raw feature matrix
    feature_matrix_raw = _build_feature_matrix(products, NUTRIENT_KEYS)

    # Step 4: fit MinMaxScaler
    scaler = MinMaxScaler(feature_range=(0.0, 1.0))
    feature_matrix_scaled = scaler.fit_transform(feature_matrix_raw)

    scaler_params: ScalerParams = {
        "data_min": scaler.data_min_.tolist(),
        "data_max": scaler.data_max_.tolist(),
        "scale": scaler.scale_.tolist(),
        "min": scaler.min_.tolist(),
        "feature_range": (0.0, 1.0),
    }

    # Step 5: build lookup indexes
    barcode_index: dict[str, int] = {}
    category_index: dict[str, list[int]] = {}

    for i, p in enumerate(products):
        code = p.get("code")
        if code:
            barcode_index[str(code)] = i

        cat = p.get("category")
        if cat:
            category_index.setdefault(cat, []).append(i)

    logger.info(
        "Index built: %d products, %d categories, %d barcodes",
        len(products),
        len(category_index),
        len(barcode_index),
    )

    # Step 6: serialise
    built_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    index: AltIndex = {
        "version": VERSION,
        "built_at": built_at,
        "builder_version": BUILDER_VERSION,
        "nutrient_keys": NUTRIENT_KEYS,
        "scaler_params": scaler_params,
        "products": products,
        "feature_matrix": feature_matrix_scaled,
        "category_index": category_index,
        "barcode_index": barcode_index,
        "source_counts": source_counts,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as fh:
        pickle.dump(index, fh, protocol=4)

    logger.info("Index saved to %s (%d bytes)", output_path, output_path.stat().st_size)
    return 0


if __name__ == "__main__":
    sys.exit(main())
