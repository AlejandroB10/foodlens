"""Loader and inference wrapper for the trained Nutri-Score RandomForest.

The model is loaded lazily on first use and cached at module level.
If the pickle does not exist (model not trained yet), all methods return None
rather than crashing — the backend degrades gracefully.

Train the model first:
    python -m backend.scripts.train_nutriscore_rf --demo          # synthetic (fast)
    python -m backend.scripts.train_nutriscore_rf --data off.csv  # real data

Public API
----------
predict(nutrients)       -> str | None          — grade letter or None
predict_proba(nutrients) -> dict[str, float] | None  — per-class probabilities
feature_names()          -> list[str]
is_loaded()              -> bool
model_meta()             -> dict                — accuracy, train_size, etc.
"""
from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger("foodlens.backend")

_DEFAULT_MODEL_PATH = Path(__file__).parent.parent / "models" / "nutriscore_rf.pkl"

# Module-level cache: None = not attempted yet, False = failed to load, dict = loaded bundle
_bundle: dict[str, Any] | None | bool = None


def _load_bundle(path: Path = _DEFAULT_MODEL_PATH) -> dict[str, Any] | None:
    global _bundle
    if _bundle is False:
        return None
    if isinstance(_bundle, dict):
        return _bundle

    if not path.exists():
        logger.warning(
            "Nutri-Score model not found at %s — run train_nutriscore_rf.py first", path
        )
        _bundle = False
        return None

    try:
        with open(path, "rb") as fh:
            _bundle = pickle.load(fh)
        logger.info(
            "Loaded Nutri-Score RF model: CV %.1f%%, trained on %d samples (%s)",
            _bundle["cv_accuracy"] * 100,
            _bundle["train_size"],
            _bundle["trained_at"],
        )
        return _bundle
    except Exception as exc:
        logger.error("Failed to load Nutri-Score RF model: %s", exc)
        _bundle = False
        return None


def _nutrients_to_vector(nutrients: dict[str, Any], feature_names: list[str]) -> np.ndarray:
    """Convert a nutrients dict (internal format) to a 1-row feature matrix."""
    row = [float(nutrients.get(k) or 0.0) for k in feature_names]
    return np.array([row], dtype=float)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def is_loaded() -> bool:
    """Return True if the model is loaded and ready."""
    return isinstance(_load_bundle(), dict)


def feature_names() -> list[str]:
    bundle = _load_bundle()
    if bundle is None:
        return []
    return bundle["feature_names"]


def model_meta() -> dict[str, Any]:
    """Return metadata about the trained model (accuracy, train size, etc.)."""
    bundle = _load_bundle()
    if bundle is None:
        return {"loaded": False}
    return {
        "loaded": True,
        "cv_accuracy": bundle["cv_accuracy"],
        "train_size": bundle["train_size"],
        "trained_at": bundle["trained_at"],
        "classes": bundle["classes"],
        "builder_version": bundle["builder_version"],
    }


def predict(nutrients: dict[str, Any]) -> str | None:
    """Predict the Nutri-Score grade for a nutrients dict.

    Parameters
    ----------
    nutrients:
        Dict with our internal nutrient keys (e.g. ``energyKcal_100g``, ``fat_100g`` …).
        Missing keys default to 0.

    Returns
    -------
    Grade string ("a"–"e") or None when the model is not loaded.
    """
    bundle = _load_bundle()
    if bundle is None:
        return None
    X = _nutrients_to_vector(nutrients, bundle["feature_names"])
    return str(bundle["model"].predict(X)[0])


def predict_proba(nutrients: dict[str, Any]) -> dict[str, float] | None:
    """Return per-class probability estimates.

    Returns
    -------
    Dict mapping grade letter → probability, or None when the model is not loaded.
    Example: {"a": 0.05, "b": 0.12, "c": 0.60, "d": 0.18, "e": 0.05}
    """
    bundle = _load_bundle()
    if bundle is None:
        return None
    X = _nutrients_to_vector(nutrients, bundle["feature_names"])
    proba = bundle["model"].predict_proba(X)[0]
    return {cls: round(float(p), 4) for cls, p in zip(bundle["classes"], proba)}
