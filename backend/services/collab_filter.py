"""Collaborative filtering over telemetry click data (F-42).

Reads alternative_click events from telemetry.jsonl and builds a co-occurrence
matrix: co[viewed_barcode][clicked_barcode] = click count. This is blended
with the KNN alternatives in the /api/alternatives endpoint.

Below MIN_CLICKS threshold the blending weight is 0 — pure KNN is returned
and meta reports collaborative_filtering: "pending_data". Above the threshold,
the CF score re-ranks alternatives that users historically chose.

Public API
----------
blend_alternatives(query_barcode, knn_result, k) -> dict
reload()  — invalidate cache and reload from disk (call after new events)
"""
from __future__ import annotations

import json
import logging
from collections import defaultdict
from pathlib import Path
from typing import Any

logger = logging.getLogger("foodlens.backend")

# Minimum total clicks for a query barcode before CF kicks in.
MIN_CLICKS = 50

# Weight of the CF signal when blending (0 = pure KNN, 1 = pure CF).
CF_BLEND_WEIGHT = 0.35

# Module-level cache
_co: dict[str, dict[str, int]] | None = None
_telemetry_path: Path | None = None


def _load_matrix(path: Path) -> dict[str, dict[str, int]]:
    """Read alternative_click events from a JSON-lines file and build co-occurrence matrix."""
    matrix: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    if not path.exists():
        return matrix
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event.get("event") != "alternative_click":
                continue
            viewed = event.get("viewed_barcode")
            clicked = event.get("clicked_barcode")
            if viewed and clicked:
                matrix[viewed][clicked] += 1
    return matrix


def _get_matrix(path: Path) -> dict[str, dict[str, int]]:
    global _co, _telemetry_path
    if _co is None or _telemetry_path != path:
        _telemetry_path = path
        _co = _load_matrix(path)
    return _co


def reload() -> None:
    """Invalidate the cached matrix so the next call reloads from disk."""
    global _co
    _co = None


def blend_alternatives(
    query_barcode: str,
    knn_result: dict[str, Any],
    k: int,
    telemetry_path: Path,
) -> dict[str, Any]:
    """Blend KNN alternatives with collaborative filtering scores.

    Parameters
    ----------
    query_barcode:
        The barcode the user is viewing.
    knn_result:
        Output of recommender.find_alternatives() — dict with "alternatives" and "meta".
    k:
        Max alternatives to return.
    telemetry_path:
        Path to telemetry.jsonl (from Config).

    Returns
    -------
    Dict with the same shape as knn_result, with meta["collaborative_filtering"]
    set to "active" or "pending_data".
    """
    alternatives = knn_result.get("alternatives", [])
    meta = dict(knn_result.get("meta", {}))

    matrix = _get_matrix(telemetry_path)
    clicked_counts = matrix.get(query_barcode, {})
    total_clicks = sum(clicked_counts.values())

    if total_clicks < MIN_CLICKS:
        meta["collaborative_filtering"] = "pending_data"
        meta["cf_clicks"] = total_clicks
        meta["cf_threshold"] = MIN_CLICKS
        return {"alternatives": alternatives, "meta": meta}

    # Compute normalised CF score for each alternative.
    for alt in alternatives:
        alt_code = str((alt.get("product") or {}).get("code") or "")
        cf_score = clicked_counts.get(alt_code, 0) / total_clicks
        # Blend: lower KNN distance = better; higher CF score = better.
        # Convert distance to similarity (1 - distance) then add CF boost.
        knn_sim = max(0.0, 1.0 - float(alt.get("distance", 1.0)))
        blended = (1.0 - CF_BLEND_WEIGHT) * knn_sim + CF_BLEND_WEIGHT * cf_score
        alt["_blended_score"] = blended

    # Re-rank by blended score descending, then strip the internal key.
    alternatives.sort(key=lambda a: a.get("_blended_score", 0.0), reverse=True)
    for alt in alternatives:
        alt.pop("_blended_score", None)

    meta["collaborative_filtering"] = "active"
    meta["cf_clicks"] = total_clicks
    return {"alternatives": alternatives[:k], "meta": meta}
