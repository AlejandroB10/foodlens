"""SHAP-based local explanation for the Nutri-Score RandomForest (F-24).

TreeExplainer is cached at module level — expensive to initialise (~1s for 200 trees),
fast thereafter (<5ms per sample). Silently returns None when the model is not loaded
or shap is not installed, so the /api/explain endpoint degrades gracefully.

Public API
----------
compute_shap_waterfall(nutrients) -> dict | None
reset_explainer()                 -> None   (call after retraining the model)
"""
from __future__ import annotations

import logging
from typing import Any

from backend.services import nutriscore_model

logger = logging.getLogger("foodlens.backend")

# Display names match frontend/js/xai.js NUTRIENT_DISPLAY_NAMES exactly.
_DISPLAY_NAMES: dict[str, str] = {
    "energyKcal_100g": "calories",
    "fat_100g": "fat",
    "saturatedFat_100g": "saturated fat",
    "sugars_100g": "sugar",
    "proteins_100g": "protein",
    "fiber_100g": "fibre",
    "salt_100g": "salt",
}

# Cached TreeExplainer — None means "not yet attempted".
_explainer = None
_explainer_tried = False


def reset_explainer() -> None:
    """Invalidate the cached explainer — call after retraining the RF model."""
    global _explainer, _explainer_tried
    _explainer = None
    _explainer_tried = False


def _get_explainer():
    global _explainer, _explainer_tried
    if _explainer_tried:
        return _explainer

    _explainer_tried = True
    bundle = nutriscore_model._load_bundle()
    if not isinstance(bundle, dict):
        logger.warning("SHAP explainer skipped — RF model not loaded")
        return None

    try:
        import shap
        _explainer = shap.TreeExplainer(bundle["model"])
        logger.info("SHAP TreeExplainer initialised (RF with %d trees)", len(bundle["model"].estimators_))
    except ImportError:
        logger.warning("shap library not installed — pip install shap")
    except Exception as exc:
        logger.warning("Could not initialise SHAP TreeExplainer: %s", exc)

    return _explainer


def compute_shap_waterfall(nutrients: dict[str, Any]) -> dict[str, Any] | None:
    """Compute SHAP feature contributions for a set of nutrient values.

    Parameters
    ----------
    nutrients:
        Dict with our internal nutrient keys (``energyKcal_100g``, ``fat_100g`` …).

    Returns
    -------
    JSON-serialisable dict for Chart.js, or None when SHAP/model is unavailable.

    Shape of the returned dict
    --------------------------
    {
        "base_value":      float,   # average model output for the predicted class
        "predicted_class": str,     # "a"|"b"|"c"|"d"|"e"
        "predicted_proba": float,   # probability of the predicted class
        "features": [
            {
                "name":          str,    # human-readable name (e.g. "sugar")
                "key":           str,    # internal key (e.g. "sugars_100g")
                "shap_value":    float,  # contribution toward predicted class
                "feature_value": float,  # raw nutrient value used by the model
            },
            ...  # sorted by |shap_value| descending
        ]
    }

    Interpretation: positive shap_value → feature pushes model toward the predicted class.
    Negative → feature opposes it (the true grade may differ from the predicted one).
    """
    explainer = _get_explainer()
    if explainer is None:
        return None

    bundle = nutriscore_model._load_bundle()
    if not isinstance(bundle, dict):
        return None

    feature_names: list[str] = bundle["feature_names"]
    classes: list[str] = bundle["classes"]
    clf = bundle["model"]

    X = nutriscore_model._nutrients_to_vector(nutrients, feature_names)

    predicted_class = str(clf.predict(X)[0])
    proba = clf.predict_proba(X)[0]
    class_idx = list(classes).index(predicted_class)
    predicted_proba = float(proba[class_idx])

    try:
        shap_values = explainer.shap_values(X)
        base_values = explainer.expected_value
    except Exception as exc:
        logger.warning("SHAP computation failed: %s", exc)
        return None

    # shap_values is list[ndarray] of length n_classes.
    # Each element has shape (n_samples, n_features).
    raw = shap_values[class_idx]
    sv = raw[0] if (hasattr(raw, "ndim") and raw.ndim == 2) else raw

    if hasattr(base_values, "__len__"):
        base = float(base_values[class_idx])
    else:
        base = float(base_values)

    features: list[dict[str, Any]] = [
        {
            "name": _DISPLAY_NAMES.get(name, name),
            "key": name,
            "shap_value": round(float(sv_val), 4),
            "feature_value": round(float(feat_val), 2),
        }
        for name, sv_val, feat_val in zip(feature_names, sv, X[0])
    ]
    features.sort(key=lambda f: abs(f["shap_value"]), reverse=True)

    return {
        "base_value": round(base, 4),
        "predicted_class": predicted_class,
        "predicted_proba": round(predicted_proba, 4),
        "features": features,
    }
