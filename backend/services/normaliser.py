"""Product normaliser — converts raw OFF JSON to the FoodLens normalised shape.

PARITY CONTRACT: output must be byte-identical (key-for-key) with frontend/js/api.js#normaliseProduct
for the same OFF input. Any change here must be mirrored in api.js and vice versa.

Key mapping quirks to preserve:
- OFF key "saturated-fat" in nutrient_levels -> our key "saturatedFat"
- OFF key "energy-kcal_100g" in nutriments   -> our key "energyKcal_100g"
- OFF key "saturated-fat_100g" in nutriments -> our key "saturatedFat_100g"
- pick_category takes the LAST element of categories_tags (most specific per OFF hierarchy),
  slugified via slugify_tag for case/whitespace stability
- "categories" holds the full slugified categories_tags list (mirrored in api.js)
"""
from __future__ import annotations

import re

from backend.services.nutriscore import normalise_grade, read_eco_score


def slugify_tag(tag: str | None) -> str | None:
    """Canonicalise an OFF category tag into a stable slug.

    Splits once on the first ':' into an optional language prefix and a
    remainder. Lowercases everything. The remainder is slugified by replacing
    every run of non-alphanumeric characters with a single '-' and trimming
    leading/trailing '-'. Rejoined as '{prefix}:{slug}' when a prefix existed,
    otherwise just '{slug}'.

    Idempotent: slugify_tag(slugify_tag(x)) == slugify_tag(x).
    Collapses case/whitespace variants:
        slugify_tag('en:Soft Drinks') == slugify_tag('en:soft-drinks')
        == 'en:soft-drinks'.

    Returns None for falsy/empty input or when the slug resolves to empty.
    """
    if not tag or not isinstance(tag, str):
        return None
    text = tag.strip().lower()
    if not text:
        return None
    if ":" in text:
        prefix, _, remainder = text.partition(":")
        slug = re.sub(r"[^a-z0-9]+", "-", remainder).strip("-")
        if not slug:
            return prefix or None
        return f"{prefix}:{slug}" if prefix else slug
    slug = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return slug or None


def slugify_categories(categories_tags: list[str] | None) -> list[str]:
    """Return a de-duplicated, order-preserving list of slugified tags."""
    if not isinstance(categories_tags, list):
        return []
    seen: set[str] = set()
    result: list[str] = []
    for tag in categories_tags:
        slug = slugify_tag(tag)
        if slug and slug not in seen:
            seen.add(slug)
            result.append(slug)
    return result

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


# Mirrors frontend/js/api.js#joinTags
def join_tags(tags: list[str] | None) -> str:
    """Flatten an OFF *_tags list into a single lowercase, space-separated string.

    Mirrors frontend/js/api.js#joinTags so the index carries the same allergen /
    label / packaging signal the OFF-direct path produces. Returns '' when the
    field is absent ('' = "unknown"), never a guessed value — passesFilters
    treats '' as "do not hide", preserving H1 and the no-data rule.
    """
    if not isinstance(tags, list):
        return ""
    return " ".join(str(tag).strip().lower() for tag in tags if str(tag).strip())


# Mirrors frontend/js/api.js#pickCategory
def pick_category(categories_tags: list[str] | None) -> str | None:
    """Return the most specific category tag (last element in OFF's hierarchical array)."""
    if not isinstance(categories_tags, list) or len(categories_tags) == 0:
        return None
    return slugify_tag(categories_tags[-1])


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
        "nutrients": {"energyKcal_100g": float|None, "fat_100g": float|None, ...},
        "allergens": str,  # '' = unknown
        "packaging": str,  # '' = unknown
        "labels": str,     # '' = unknown
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
        # Backend-index-only: full slugified category hierarchy, used by the
        # KNN index builder to make every product reachable by coarse tags.
        # Mirrored in frontend/js/api.js#normaliseProduct for parity.
        "categories": slugify_categories(raw.get("categories_tags")),
        "nutriScore": normalise_grade(raw.get("nutriscore_grade")),
        "ecoScore": read_eco_score(raw),
        "nutrientLevels": read_nutrient_levels(raw.get("nutrient_levels")),
        "nutrients": read_nutrients(raw.get("nutriments")),
        # Lowercase, space-separated tag strings. '' means "unknown" (field
        # absent), which passesFilters must treat as "do not hide", never as a
        # value. Mirrors frontend/js/api.js#normaliseProduct for parity.
        "allergens": join_tags(raw.get("allergens_tags")),
        "packaging": join_tags(raw.get("packaging_tags")),
        "labels": join_tags(raw.get("labels_tags")),
    }
