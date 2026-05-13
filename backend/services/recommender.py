"""KNN-based product recommender over a preloaded IndexStore.

Mirrors design §5 (KNN algorithm step-by-step) and spec R-KNN-1 through R-KNN-4.

Public API:
    find_alternatives(product, index, k, health_weight) -> dict

No scikit-learn at inference time. The index already contains scaled feature
vectors; scaler logic lives in IndexStore.scale_query (design D5).
"""
from __future__ import annotations

import logging
import math
from typing import Any

import numpy as np

from backend.services.index_store import IndexStore
from backend.services.nutriscore import is_strictly_better

logger = logging.getLogger("foodlens.backend")

# Minimum pool size per category; below this we refuse to query.
_MIN_POOL_SIZE = 3

# Candidates to consider before applying the strict-better filter.
_MAX_CANDIDATES = 20


def find_alternatives(
    product: dict,
    index: IndexStore,
    k: int = 3,
    health_weight: float = 0.5,
) -> dict[str, Any]:
    """Return up to k strictly-better alternatives for a product from the index.

    Parameters
    ----------
    product:
        Normalised product dict (output of normaliser.normalise_product).
        Must have ``code``, ``category``, ``nutriScore.grade``,
        ``ecoScore.numeric``, and ``nutrients`` keys.
    index:
        Loaded IndexStore instance.
    k:
        Maximum number of alternatives to return (1..10).
    health_weight:
        0.0 = full eco weight, 1.0 = full health weight.
        Controls the weighted distance formula (design §5, step 6).

    Returns
    -------
    dict with keys:
        ``alternatives`` — list of dicts, each with ``product``, ``distance``,
            and ``delta_text`` keys.
        ``meta`` — dict with ``reason``, ``pool_size``, ``health_weight``,
            ``k_requested``, ``k_returned``.
    """
    if not index.is_loaded():
        return _empty("index_not_loaded", 0, health_weight, k)

    query_barcode = str(product.get("code") or "")
    category = product.get("category")
    query_nutri_grade = (product.get("nutriScore") or {}).get("grade")
    query_eco_numeric = (product.get("ecoScore") or {}).get("numeric")

    # Step 3: check pool size before anything else.
    if not category:
        return _empty("category-not-in-index", 0, health_weight, k)

    pool_products = index.filter_by_category(category)
    # Exclude the query product itself from the pool.
    pool_products = [p for p in pool_products if str(p.get("code") or "") != query_barcode]

    if len(pool_products) < _MIN_POOL_SIZE:
        logger.debug(
            "Category %s has %d products in index (minimum %d) — returning empty",
            category, len(pool_products), _MIN_POOL_SIZE,
        )
        return _empty("category-not-in-index", len(pool_products), health_weight, k)

    # Step 5 guard: unknown grade on query prevents filtering.
    if query_nutri_grade not in ("a", "b", "c", "d", "e"):
        return _empty("unknown_grade_on_query", len(pool_products), health_weight, k)

    # Step 2: project query into scaled space.
    query_scaled = index.scale_query(product)

    # Build per-category scaled matrix for the pool products.
    # We use scaled_pool then re-filter to exclude the query product.
    full_matrix, full_products = index.scaled_pool(category)

    # Match pool_products back to rows in the full matrix.
    # pool_products already excludes the query barcode.
    query_barcodes_to_skip = {query_barcode}
    selected_rows = []
    selected_products = []
    for prod in full_products:
        if str(prod.get("code") or "") not in query_barcodes_to_skip:
            selected_products.append(prod)

    # Rebuild indices from category to match selected_products order.
    # Use filter_by_category result order for safety.
    pool_scaled_rows = []
    for prod in pool_products:
        row_scaled = index.scale_query(prod)
        pool_scaled_rows.append(row_scaled)

    pool_matrix = np.array(pool_scaled_rows, dtype=float) if pool_scaled_rows else np.empty((0, query_scaled.shape[0]))

    pool_size = len(pool_products)

    # Step 4: compute Euclidean distances, take K' = min(20, pool_size) nearest.
    n_features = query_scaled.shape[0]
    if pool_matrix.shape[0] == 0 or pool_matrix.shape[1] != n_features:
        return _empty("category-not-in-index", pool_size, health_weight, k)

    diffs = pool_matrix - query_scaled
    euclidean_distances = np.sqrt(np.sum(diffs ** 2, axis=1))

    k_prime = min(_MAX_CANDIDATES, pool_size)
    nearest_indices = np.argsort(euclidean_distances)[:k_prime]

    # Step 5: strict-better filter.
    # Spec R-KNN-3: keep candidates where:
    #   nutriscore strictly better than query OR
    #   (nutriscore equal AND ecoscore strictly better)
    # AND nutriscore grade must be a known letter (not 'unknown' / 'not-applicable').
    filtered: list[tuple[float, float, dict]] = []  # (euclidean, weighted, product)

    for idx in nearest_indices:
        candidate = pool_products[idx]
        cand_nutri_grade = (candidate.get("nutriScore") or {}).get("grade")
        cand_eco_numeric = (candidate.get("ecoScore") or {}).get("numeric")
        euclid = float(euclidean_distances[idx])

        # Discard unknown/not-applicable grades on candidate side.
        if cand_nutri_grade not in ("a", "b", "c", "d", "e"):
            continue

        nutri_strictly_better = is_strictly_better(cand_nutri_grade, query_nutri_grade)
        nutri_equal = cand_nutri_grade == query_nutri_grade

        if nutri_strictly_better:
            passes = True
        elif nutri_equal:
            # Eco must be strictly better; query eco must be known.
            if query_eco_numeric is not None and cand_eco_numeric is not None:
                passes = cand_eco_numeric > query_eco_numeric
            else:
                passes = False
        else:
            passes = False

        if not passes:
            continue

        # Step 6: weighted distance (design §5 step 6).
        weighted = _weighted_distance(euclid, query_eco_numeric, cand_eco_numeric, health_weight)
        filtered.append((euclid, weighted, candidate))

    if not filtered:
        return _empty("no_better_alternative_in_category", pool_size, health_weight, k)

    # Sort by weighted distance ascending, take top-k.
    filtered.sort(key=lambda t: t[1])
    top_k = filtered[:k]

    # Import here to avoid circular dependency (explainer -> recommender possible).
    from backend.services.explainer import format_alternative_delta

    alternatives = []
    for euclid, weighted, candidate in top_k:
        delta_text = format_alternative_delta(product, candidate)
        alternatives.append({
            "product": candidate,
            "distance": round(float(weighted), 4),
            "delta_text": delta_text,
        })

    return {
        "alternatives": alternatives,
        "meta": {
            "reason": None,
            "pool_size": pool_size,
            "health_weight": health_weight,
            "k_requested": k,
            "k_returned": len(alternatives),
        },
    }


def _weighted_distance(
    euclid: float,
    query_eco_numeric: int | None,
    candidate_eco_numeric: int | None,
    health_weight: float,
) -> float:
    """Apply the weighted distance formula from design §5 step 6.

    eco_gap = max(0, query.eco_numeric - candidate.eco_numeric)  # positive if candidate worse
    eco_penalty = eco_gap * 0.2
    weighted = health_weight * euclidean + (1 - health_weight) * eco_penalty

    When either eco numeric is None, eco_penalty = 0 (eco term silently drops).
    """
    if query_eco_numeric is not None and candidate_eco_numeric is not None:
        eco_gap = max(0, query_eco_numeric - candidate_eco_numeric)
        eco_penalty = eco_gap * 0.2
    else:
        eco_penalty = 0.0

    return health_weight * euclid + (1.0 - health_weight) * eco_penalty


def _empty(reason: str, pool_size: int, health_weight: float, k: int) -> dict[str, Any]:
    return {
        "alternatives": [],
        "meta": {
            "reason": reason,
            "pool_size": pool_size,
            "health_weight": health_weight,
            "k_requested": k,
            "k_returned": 0,
        },
    }
