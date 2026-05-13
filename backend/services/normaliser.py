"""Product normaliser — converts raw OFF JSON to the FoodLens normalised shape.

PARITY CONTRACT: output must be byte-identical (key-for-key) with frontend/js/api.js#normaliseProduct
for the same OFF input. Any change here must be mirrored in api.js and vice versa.

Key mapping quirks to preserve:
- OFF key "saturated-fat" in nutrient_levels -> our key "saturatedFat"
- OFF key "energy-kcal_100g" in nutriments   -> our key "energyKcal_100g"
- OFF key "saturated-fat_100g" in nutriments -> our key "saturatedFat_100g"
- pick_category takes the LAST element of categories_tags (most specific per OFF hierarchy)
"""
from __future__ import annotations

from backend.services.nutriscore import normalise_grade, read_eco_score

# Mirrors frontend/js/api.js NUTRIENT_LEVEL_KEY_MAP
_NUTRIENT_LEVEL_KEY_MAP: dict[str, str] = {
    "fat": "fat",
    "salt": "salt",
    "saturated-fat": "saturatedFat",
    "sugars": "sugars",
}

_VALID_LEVELS = frozenset({"low", "moderate", "high"})


# Mirrors frontend/js/api.js#splitBrands
def split_brands(brands: str | None) -> list[str]:
    """Split a comma-separated brands string into a list, stripping whitespace."""
    if not brands or not isinstance(brands, str):
        return []
    return [b.strip() for b in brands.split(",") if b.strip()]


# Mirrors frontend/js/api.js#pickCategory
def pick_category(categories_tags: list[str] | None) -> str | None:
    """Return the most specific category tag (last element in OFF's hierarchical array)."""
    if not isinstance(categories_tags, list) or len(categories_tags) == 0:
        return None
    return categories_tags[-1]


# Mirrors frontend/js/api.js#readNutrientLevels
def read_nutrient_levels(raw_levels: dict | None) -> dict[str, str | None]:
    """Parse nutrient_levels dict from OFF, mapping OFF keys to our camelCase keys."""
    levels = raw_levels or {}
    result: dict[str, str | None] = {"fat": None, "salt": None, "saturatedFat": None, "sugars": None}
    for off_key, our_key in _NUTRIENT_LEVEL_KEY_MAP.items():
        v = levels.get(off_key)
        if v in _VALID_LEVELS:
            result[our_key] = v
    return result


# Mirrors frontend/js/api.js#readNutrients
def read_nutrients(raw_nutriments: dict | None) -> dict[str, float | None]:
    """Parse nutriments dict from OFF, mapping OFF keys to our shape."""
    n = raw_nutriments or {}

    def pick_numeric(key: str) -> float | None:
        v = n.get(key)
        return v if isinstance(v, (int, float)) else None

    return {
        "energyKcal_100g": pick_numeric("energy-kcal_100g"),
        "fat_100g": pick_numeric("fat_100g"),
        "saturatedFat_100g": pick_numeric("saturated-fat_100g"),
        "sugars_100g": pick_numeric("sugars_100g"),
        "salt_100g": pick_numeric("salt_100g"),
        "fiber_100g": pick_numeric("fiber_100g"),
        "proteins_100g": pick_numeric("proteins_100g"),
    }


# Mirrors frontend/js/api.js#normaliseProduct
def normalise_product(raw: dict | None) -> dict | None:
    """Convert a raw OFF product dict to the FoodLens normalised shape.

    Returns None when raw is falsy (mirrors JS return null).

    Output shape:
    {
        "source": "api",
        "code": str | None,
        "name": str | None,
        "brands": list[str],
        "image": str | None,
        "category": str | None,
        "nutriScore": {"grade": str, "numeric": int | None},
        "ecoScore": {"grade": str, "numeric": int | None, "sourceField": str | None},
        "nutrientLevels": {"fat": str|None, "salt": str|None, "saturatedFat": str|None, "sugars": str|None},
        "nutrients": {"energyKcal_100g": float|None, "fat_100g": float|None, ...}
    }
    """
    if raw is None:
        return None

    return {
        "source": "api",
        "code": raw.get("code") or None,
        "name": raw.get("product_name") or None,
        "brands": split_brands(raw.get("brands")),
        "image": raw.get("image_front_url") or None,
        "category": pick_category(raw.get("categories_tags")),
        "nutriScore": normalise_grade(raw.get("nutriscore_grade")),
        "ecoScore": read_eco_score(raw),
        "nutrientLevels": read_nutrient_levels(raw.get("nutrient_levels")),
        "nutrients": read_nutrients(raw.get("nutriments")),
    }
