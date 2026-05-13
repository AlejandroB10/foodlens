"""Python port of frontend/js/xai.js — contrastive sentence generator.

Mirrors frontend/js/xai.js — replaced by SHAP in F-24.

Public API:
    generate_contrastive_sentence(product, reference) -> dict
    build_category_average_reference(products, category) -> dict | None
    format_alternative_delta(product, alternative) -> str
    pick_most_differentiating_nutrient(product, reference) -> dict | None

Parity contract (spec R-XAI-3):
- Same nutrient candidate order as JS: sugars, saturatedFat, fat, salt, proteins, fiber.
- Same >= 5% threshold for pickMostDifferentiatingNutrient.
- Same formatPct: Math.round(abs(value)), appended with '%'.
- Same formatGrams tiered logic: <1 -> toFixed(2)g, <10 -> toFixed(1)g, else round()g.
- Moralising vocabulary is NEVER emitted.
"""
from __future__ import annotations

import math
from typing import Any

# Nutrient display names — matches JS NUTRIENT_DISPLAY_NAMES exactly.
_NUTRIENT_DISPLAY_NAMES: dict[str, str] = {
    "sugars_100g": "sugar",
    "fat_100g": "fat",
    "saturatedFat_100g": "saturated fat",
    "salt_100g": "salt",
    "fiber_100g": "fibre",
    "proteins_100g": "protein",
    "energyKcal_100g": "calories",
}

# Candidate order for pickMostDifferentiatingNutrient — matches JS exactly.
_PICK_CANDIDATE_ORDER = [
    "sugars_100g",
    "saturatedFat_100g",
    "fat_100g",
    "salt_100g",
    "proteins_100g",
    "fiber_100g",
]

# Keys used for category-average computation — matches JS buildCategoryAverageReference.
_AVERAGE_KEYS = [
    "sugars_100g",
    "fat_100g",
    "saturatedFat_100g",
    "salt_100g",
    "proteins_100g",
    "fiber_100g",
    "energyKcal_100g",
]

# Keys used for formatAlternativeDelta — matches JS FALLBACK_DELTAS.
_DELTA_KEYS = [
    "sugars_100g",
    "fat_100g",
    "saturatedFat_100g",
    "salt_100g",
    "proteins_100g",
    "fiber_100g",
]

_GRADE_RANK: dict[str, int] = {"a": 5, "b": 4, "c": 3, "d": 2, "e": 1}


# ---------------------------------------------------------------------------
# Internal helpers — pure functions mirroring JS helpers
# ---------------------------------------------------------------------------


def _is_numeric_grade(grade: str | None) -> bool:
    return isinstance(grade, str) and grade in _GRADE_RANK


def _grade_compare(a: str | None, b: str | None) -> int | None:
    """Positive => a is better than b. None if either is non-numeric."""
    if not _is_numeric_grade(a) or not _is_numeric_grade(b):
        return None
    assert a is not None and b is not None
    return _GRADE_RANK[a] - _GRADE_RANK[b]


def _pct_change(product_value: float | None, reference_value: float | None) -> float | None:
    """Percentage change of product relative to reference. None on bad inputs."""
    if not isinstance(product_value, (int, float)):
        return None
    if not isinstance(reference_value, (int, float)):
        return None
    if reference_value == 0:
        return None
    return ((product_value - reference_value) / reference_value) * 100.0


def _format_pct(value: float) -> str:
    """Mirror JS formatPct: round abs(value), append '%'."""
    return f"{round(abs(value))}%"


def _format_grams(value: float | None) -> str | None:
    """Mirror JS formatGrams: <1 -> toFixed(2)g, <10 -> toFixed(1)g, else round()g."""
    if value is None:
        return None
    if value < 1:
        return f"{value:.2f}g"
    if value < 10:
        return f"{value:.1f}g"
    return f"{round(value)}g"


def _reference_label(reference: dict) -> str:
    """Mirror JS referenceLabel — return display name for the reference object."""
    kind = reference.get("kind")
    if kind == "category-average":
        return "the category average"
    if kind == "usual":
        return "your usual choice"
    return reference.get("name") or "an alternative"


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------


def pick_most_differentiating_nutrient(product: dict, reference: dict) -> dict[str, Any] | None:
    """Return the nutrient with the largest percentage delta (>= 5% threshold).

    Mirrors JS pickMostDifferentiatingNutrient exactly:
    - Candidate order: sugars, saturatedFat, fat, salt, proteins, fiber.
    - Only considers deltas where abs(delta) >= 5%.
    - Returns the one with the largest absolute delta.
    """
    p_nutrients = product.get("nutrients") or {}
    r_nutrients = reference.get("nutrients") or {}

    best: dict[str, Any] | None = None
    best_abs = 0.0

    for key in _PICK_CANDIDATE_ORDER:
        p_val = p_nutrients.get(key)
        r_val = r_nutrients.get(key)
        if not isinstance(p_val, (int, float)) or not isinstance(r_val, (int, float)):
            continue
        delta = _pct_change(p_val, r_val)
        if delta is None:
            continue
        abs_delta = abs(delta)
        if abs_delta > best_abs and abs_delta >= 5.0:
            best_abs = abs_delta
            best = {
                "key": key,
                "product_value": p_val,
                "reference_value": r_val,
                "delta_pct": delta,
            }

    return best


def generate_contrastive_sentence(product: dict, reference: dict) -> dict[str, Any]:
    """Generate the contrastive sentence for a product vs. a reference.

    Mirrors JS generateContrastiveSentence exactly.

    Parameters
    ----------
    product:
        Normalised product dict.
    reference:
        One of:
        - {"kind": "product", ...normalised product...}
        - {"kind": "category-average", "nutrients": {...}, ...}
        - {"kind": "usual", ...normalised product...}

    Returns
    -------
    {"sentence": str, "hasComparison": bool}
    """
    if not product:
        return {"sentence": "No product to explain.", "hasComparison": False}

    if not reference:
        return {
            "sentence": "Insufficient data to compare this product against a reference.",
            "hasComparison": False,
        }

    ref_label = _reference_label(reference)
    product_grade_nutri = (product.get("nutriScore") or {}).get("grade")
    ref_grade_nutri = (reference.get("nutriScore") or {}).get("grade")
    product_grade_eco = (product.get("ecoScore") or {}).get("grade")
    ref_grade_eco = (reference.get("ecoScore") or {}).get("grade")

    nutrient_delta = pick_most_differentiating_nutrient(product, reference)
    nutri_diff = _grade_compare(product_grade_nutri, ref_grade_nutri)
    eco_diff = _grade_compare(product_grade_eco, ref_grade_eco)

    # Preferred shape: one nutrient delta + one score comparison.
    if nutrient_delta is not None:
        direction = "less" if nutrient_delta["delta_pct"] < 0 else "more"
        nutrient_name = _NUTRIENT_DISPLAY_NAMES.get(nutrient_delta["key"], nutrient_delta["key"])
        pct = _format_pct(nutrient_delta["delta_pct"])
        base = f"This product has {pct} {direction} {nutrient_name} per 100g than {ref_label}"

        if nutri_diff is not None and nutri_diff != 0:
            compare = "better" if nutri_diff > 0 else "worse"
            pg = str(product_grade_nutri).upper()
            rg = str(ref_grade_nutri).upper()
            return {
                "sentence": f"{base}, with a {compare} Nutri-Score ({pg} vs {rg}).",
                "hasComparison": True,
            }
        if eco_diff is not None and eco_diff != 0:
            compare = "better" if eco_diff > 0 else "worse"
            pg = str(product_grade_eco).upper()
            rg = str(ref_grade_eco).upper()
            return {
                "sentence": f"{base}, with a {compare} Environmental Score ({pg} vs {rg}).",
                "hasComparison": True,
            }
        return {"sentence": f"{base}.", "hasComparison": True}

    # Fallback 1: grades differ but no nutrient delta.
    if nutri_diff is not None and nutri_diff != 0:
        compare = "better" if nutri_diff > 0 else "worse"
        pg = str(product_grade_nutri).upper()
        rg = str(ref_grade_nutri).upper()
        return {
            "sentence": f"This product has a {compare} Nutri-Score than {ref_label} ({pg} vs {rg}).",
            "hasComparison": True,
        }
    if eco_diff is not None and eco_diff != 0:
        compare = "better" if eco_diff > 0 else "worse"
        pg = str(product_grade_eco).upper()
        rg = str(ref_grade_eco).upper()
        return {
            "sentence": f"This product has a {compare} Environmental Score than {ref_label} ({pg} vs {rg}).",
            "hasComparison": True,
        }

    # Fallback 2: nothing comparable.
    return {
        "sentence": f"Insufficient comparable data between this product and {ref_label}.",
        "hasComparison": False,
    }


def build_category_average_reference(products: list[dict], category: str) -> dict | None:
    """Build a category-average pseudo-product from a list of products.

    Mirrors JS buildCategoryAverageReference exactly.
    Returns None if no products match the category or all nutrients are missing.
    """
    same_category = [p for p in products if p.get("category") == category]
    if not same_category:
        return None

    sums: dict[str, float] = {}
    counts: dict[str, int] = {}

    for p in same_category:
        nutrients = p.get("nutrients") or {}
        for k in _AVERAGE_KEYS:
            v = nutrients.get(k)
            if isinstance(v, (int, float)):
                sums[k] = sums.get(k, 0.0) + float(v)
                counts[k] = counts.get(k, 0) + 1

    if not counts:
        return None

    averaged: dict[str, float | None] = {}
    for k in _AVERAGE_KEYS:
        if counts.get(k):
            averaged[k] = sums[k] / counts[k]
        else:
            averaged[k] = None

    return {
        "kind": "category-average",
        "name": "the category average",
        "nutrients": averaged,
        "nutriScore": {"grade": None, "numeric": None},
        "ecoScore": {"grade": None, "numeric": None, "sourceField": None},
    }


def format_alternative_delta(product: dict, alternative: dict) -> str:
    """Return a one-line delta string for an alternative card.

    Mirrors JS formatAlternativeDelta exactly.
    Example: "4.1g less sugar, 3.7g more protein per 100g."
    """
    p_nutrients = product.get("nutrients") or {}
    a_nutrients = alternative.get("nutrients") or {}
    parts: list[str] = []

    for key in _DELTA_KEYS:
        p_val = p_nutrients.get(key)
        a_val = a_nutrients.get(key)
        if not isinstance(p_val, (int, float)) or not isinstance(a_val, (int, float)):
            continue
        delta = a_val - p_val
        if abs(delta) < 0.2:
            continue
        direction = "less" if delta < 0 else "more"
        formatted = _format_grams(abs(delta))
        if not formatted:
            continue
        nutrient_name = _NUTRIENT_DISPLAY_NAMES.get(key, key)
        parts.append(f"{formatted} {direction} {nutrient_name}")
        if len(parts) >= 2:
            break

    if not parts:
        return "Same nutritional profile, different overall score."
    return f"{', '.join(parts)} per 100g."
