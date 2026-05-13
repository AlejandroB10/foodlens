"""Nutri-Score and Eco-Score utilities.

All functions mirror frontend/js/api.js#normaliseGrade exactly.
No recomputation of scores — only grade parsing and mapping.
"""
from __future__ import annotations

# Mirrors frontend/js/api.js#normaliseGrade
GRADE_TO_NUMERIC: dict[str, int] = {"a": 5, "b": 4, "c": 3, "d": 2, "e": 1}

# Colour map per grade (CSS variable names match docs/conventions.md)
GRADE_TO_COLOUR: dict[str, str] = {
    "a": "#2ecc71",
    "b": "#a8d635",
    "c": "#f7b731",
    "d": "#f39c12",
    "e": "#e74c3c",
    "not-applicable": "#999999",
    "unknown": "#999999",
}

_VALID_GRADES = frozenset({"a", "b", "c", "d", "e"})
_SPECIAL_GRADES = frozenset({"not-applicable", "unknown"})


# Mirrors frontend/js/api.js#normaliseGrade
def normalise_grade(raw: str | None) -> dict[str, str | int | None]:
    """Parse a raw OFF grade string into a normalised dict.

    Returns
    -------
    {"grade": "a"|"b"|"c"|"d"|"e"|"unknown"|"not-applicable", "numeric": int | None}
    """
    if not raw or not isinstance(raw, str):
        return {"grade": "unknown", "numeric": None}
    lower = raw.lower()
    if lower in _VALID_GRADES:
        return {"grade": lower, "numeric": GRADE_TO_NUMERIC[lower]}
    if lower in _SPECIAL_GRADES:
        return {"grade": lower, "numeric": None}
    return {"grade": "unknown", "numeric": None}


# Mirrors frontend/js/api.js#readEcoScore
def read_eco_score(raw_product: dict) -> dict[str, str | int | None]:
    """Parse eco-score from a raw OFF product dict.

    Fallback order: environmental_score_grade first, then ecoscore_grade.

    Returns
    -------
    {"grade": ..., "numeric": ..., "sourceField": "environmental_score_grade" | "ecoscore_grade" | None}
    """
    new_field = raw_product.get("environmental_score_grade")
    if new_field:
        parsed = normalise_grade(new_field)
        return {**parsed, "sourceField": "environmental_score_grade"}

    legacy = raw_product.get("ecoscore_grade")
    if legacy:
        parsed = normalise_grade(legacy)
        return {**parsed, "sourceField": "ecoscore_grade"}

    return {"grade": "unknown", "numeric": None, "sourceField": None}


def grade_rank(grade: str | None) -> int | None:
    """Return numeric rank for a grade string, or None for unknown/not-applicable/None."""
    if grade is None:
        return None
    return GRADE_TO_NUMERIC.get(grade.lower())


def is_strictly_better(a_grade: str | None, b_grade: str | None) -> bool:
    """Return True if grade a is strictly better than grade b.

    "Better" means higher numeric rank (a=5 is best, e=1 is worst).
    Returns False when either grade is unknown or not-applicable.
    """
    a_num = grade_rank(a_grade)
    b_num = grade_rank(b_grade)
    if a_num is None or b_num is None:
        return False
    return a_num > b_num


def grade_colour(grade: str | None) -> str:
    """Return the hex colour for a given grade string."""
    if grade is None:
        return GRADE_TO_COLOUR["unknown"]
    return GRADE_TO_COLOUR.get(grade.lower(), GRADE_TO_COLOUR["unknown"])
