"""Flask application factory for FoodLens backend.

Wiring layer only — no business logic lives here.
Routes: GET /, GET /health, GET /api/search, GET /api/product/<barcode>,
        GET /api/alternatives/<barcode>, GET /api/explain/<barcode>
"""
from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request
from flask_cors import CORS

from backend.config import Config, load_config
from backend.services.index_store import IndexStore, IndexVersionError
from backend.services.off_client import (
    OFFTimeoutError,
    OFFUpstreamError,
    OpenFoodFactsClient,
    RateLimitExceeded,
)
from backend.services.normaliser import normalise_product
from backend.services import recommender as _recommender
from backend.services import explainer as _explainer
from backend.services import nutriscore_model as _nutriscore_model
from backend.services import shap_explainer as _shap_explainer
from backend.services import collab_filter as _collab_filter

VERSION = "0.1.0"

logger = logging.getLogger("foodlens.backend")


def _configure_logging(level: str) -> None:
    logging.basicConfig(
        stream=sys.stdout,
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )


def _make_error(code: str, message: str, status: int, **extra: Any):
    body: dict[str, Any] = {"code": code, "message": message}
    body.update(extra)
    return jsonify({"error": body}), status


def create_app(config: Config | None = None, index_store: IndexStore | None = None) -> Flask:
    """Create and configure the Flask application.

    Parameters
    ----------
    config:
        If None, ``load_config()`` is called to read from the environment.
    index_store:
        Injectable for tests. If None, a real IndexStore is constructed from
        ``config.index_path`` and loaded at startup (degraded mode on failure).
    """
    if config is None:
        config = load_config()

    _configure_logging(config.log_level)

    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False

    # MVP-only: must be tightened to specific origins before any deploy
    CORS(app, origins="*")

    # --- IndexStore ---
    if index_store is None:
        store = IndexStore(config.index_path)
        try:
            store.load()
        except IndexVersionError as exc:
            logger.error("Index version mismatch at startup: %s", exc)
        except FileNotFoundError:
            logger.warning("Index file not found at %s — starting in degraded mode", config.index_path)
        except Exception as exc:
            logger.error("Failed to load index: %s", exc)
    else:
        store = index_store

    # --- OFF client ---
    off_client = OpenFoodFactsClient(config)

    # Attach to app for route access
    app.extensions["index_store"] = store
    app.extensions["off_client"] = off_client
    app.extensions["app_config"] = config

    # --- Error handlers (JSON only, never HTML) ---
    @app.errorhandler(400)
    def bad_request(exc):
        return _make_error("bad_request", str(exc), 400)

    @app.errorhandler(404)
    def not_found(exc):
        return _make_error("not_found", "The requested resource was not found.", 404)

    @app.errorhandler(405)
    def method_not_allowed(exc):
        return _make_error("method_not_allowed", "Method not allowed.", 405)

    @app.errorhandler(500)
    def internal_error(exc):
        logger.exception("Unhandled exception")
        return _make_error("internal_error", "An internal error occurred.", 500)

    # --- Routes ---

    @app.get("/")
    def info_route():
        return jsonify({"name": "FoodLens Backend", "version": VERSION, "status": "ok"})

    @app.get("/health")
    def health_route():
        idx: IndexStore = app.extensions["index_store"]
        client: OpenFoodFactsClient = app.extensions["off_client"]
        cache_backend = client.cache_backend
        rf_meta = _nutriscore_model.model_meta()
        if idx.is_loaded():
            body = {
                "status": "ok",
                "index_built_at": idx.built_at(),
                "index_size": idx.size(),
                "cache_backend": cache_backend,
                "nutriscore_model": rf_meta,
                "version": VERSION,
            }
            return jsonify(body), 200
        else:
            reason = getattr(idx, "_degraded_reason", "index_not_loaded")
            body = {
                "status": "degraded",
                "reason": reason,
                "index_built_at": None,
                "index_size": 0,
                "cache_backend": cache_backend,
                "nutriscore_model": rf_meta,
                "version": VERSION,
            }
            return jsonify(body), 200

    @app.get("/api/search")
    def search_route():
        q = request.args.get("q", "").strip()
        if not q:
            return _make_error("MISSING_PARAM", "missing required parameter: q", 400)

        client: OpenFoodFactsClient = app.extensions["off_client"]
        try:
            products_raw, source_tag = client.search(q)
        except RateLimitExceeded:
            import math
            wait = math.ceil(client.bucket_for_endpoint("search").time_until_available())
            resp = _make_error("rate_limited", "Client-side rate limit reached for /search.", 429)
            resp[0].headers["Retry-After"] = str(wait)
            return resp
        except OFFUpstreamError as exc:
            return _make_error(
                "upstream_unavailable",
                "Upstream OFF returned an error.",
                503,
                upstream_status=exc.status_code,
            )
        except OFFTimeoutError:
            return _make_error("upstream_timeout", "Upstream OFF timed out.", 504)

        normalised = [p for p in (normalise_product(r) for r in products_raw) if p is not None]
        resp = jsonify({"count": len(normalised), "products": normalised})
        resp.headers["X-Data-Source"] = source_tag
        return resp, 200

    @app.get("/api/product/<barcode>")
    def product_route(barcode: str):
        client: OpenFoodFactsClient = app.extensions["off_client"]
        try:
            raw, source_tag = client.get_product(barcode)
        except RateLimitExceeded:
            import math
            wait = math.ceil(client.bucket_for_endpoint("product").time_until_available())
            resp = _make_error("rate_limited", "Client-side rate limit reached for /product.", 429)
            resp[0].headers["Retry-After"] = str(wait)
            return resp
        except OFFUpstreamError as exc:
            if exc.status_code == 404:
                return _make_error(
                    "PRODUCT_NOT_FOUND",
                    f"No product with barcode {barcode} was found.",
                    404,
                    barcode=barcode,
                )
            return _make_error(
                "OFF_UNAVAILABLE",
                "upstream unavailable",
                503,
                upstream_status=exc.status_code,
            )
        except OFFTimeoutError:
            return _make_error("upstream_timeout", "Upstream OFF timed out.", 504)

        if raw is None:
            return _make_error(
                "PRODUCT_NOT_FOUND",
                f"No product with barcode {barcode} was found.",
                404,
                barcode=barcode,
            )

        normalised = normalise_product(raw)
        if normalised is None:
            return _make_error("PRODUCT_NOT_FOUND", f"Product {barcode} could not be normalised.", 404)

        resp = jsonify(normalised)
        resp.headers["X-Data-Source"] = source_tag
        return resp, 200

    # --- /api/alternatives/<barcode> ---

    @app.get("/api/alternatives/<barcode>")
    def alternatives_route(barcode: str):
        """Return up to k strictly-better alternatives from the prebuilt index.

        Query params:
            k      int  1..10  (default 3)
            weight float 0..1  (default 0.5; 1 = full health, 0 = full eco)
        """
        idx: IndexStore = app.extensions["index_store"]
        client: OpenFoodFactsClient = app.extensions["off_client"]

        if not idx.is_loaded():
            return _make_error("index_not_loaded", "Index not loaded — run build_knn_index.py first.", 503)

        # --- Parse and validate query params ---
        try:
            k = int(request.args.get("k", "3"))
            if not (1 <= k <= 10):
                raise ValueError("k out of range")
        except ValueError:
            return _make_error("invalid_param", "Parameter k must be an integer between 1 and 10.", 400)

        try:
            health_weight = float(request.args.get("weight", "0.5"))
            if not (0.0 <= health_weight <= 1.0):
                raise ValueError("weight out of range")
        except ValueError:
            return _make_error("invalid_param", "Parameter weight must be a float between 0 and 1.", 400)

        # --- Resolve query product ---
        query_product = idx.get_by_barcode(barcode)
        source_tag = "index"

        if query_product is None:
            # Not in index — fetch live from OFF (spec R-KNN-4).
            try:
                raw, source_tag = client.get_product(barcode)
            except RateLimitExceeded:
                import math as _math
                wait = _math.ceil(client.bucket_for_endpoint("product").time_until_available())
                resp = _make_error("rate_limited", "Client-side rate limit reached.", 429)
                resp[0].headers["Retry-After"] = str(wait)
                return resp
            except OFFUpstreamError as exc:
                if exc.status_code == 404:
                    body = {
                        "barcode": barcode,
                        "query_product": None,
                        "alternatives": [],
                        "meta": {
                            "reason": "barcode_not_found",
                            "pool_size": 0,
                            "health_weight": health_weight,
                            "k_requested": k,
                            "k_returned": 0,
                        },
                    }
                    return jsonify(body), 200
                return _make_error("off_unavailable_no_index_hit", "OFF unavailable and barcode not in index.", 503)
            except OFFTimeoutError:
                return _make_error("upstream_timeout", "Upstream OFF timed out.", 504)

            if raw is None:
                body = {
                    "barcode": barcode,
                    "query_product": None,
                    "alternatives": [],
                    "meta": {
                        "reason": "barcode_not_found",
                        "pool_size": 0,
                        "health_weight": health_weight,
                        "k_requested": k,
                        "k_returned": 0,
                    },
                }
                return jsonify(body), 200

            query_product = normalise_product(raw)
            if query_product is None:
                return _make_error("barcode_not_found", f"Could not normalise product {barcode}.", 404)

        # --- Run recommender + collaborative filter blend (F-42) ---
        result = _recommender.find_alternatives(query_product, idx, k=k, health_weight=health_weight)
        cfg: Config = app.extensions["app_config"]
        result = _collab_filter.blend_alternatives(barcode, result, k, cfg.telemetry_path)

        body = {
            "barcode": barcode,
            "query_product": query_product,
            "alternatives": result["alternatives"],
            "meta": result["meta"],
        }

        resp = jsonify(body)
        resp.headers["X-Data-Source"] = source_tag
        if idx.built_at():
            resp.headers["X-Index-Built-At"] = idx.built_at()
        return resp, 200

    # --- /api/telemetry (F-45) ---

    @app.post("/api/telemetry")
    def telemetry_route():
        """Append a telemetry event to telemetry.jsonl (F-45).

        Only called when the user has opted in (frontend enforces this).
        Accepts any JSON object with at minimum an "event" string field.
        Unknown fields are stored as-is for future analysis.

        Events logged:
            decision_time       { event, barcode, ms }
            alternative_click   { event, viewed_barcode, clicked_barcode }
            slider_change       { event, value }
        """
        import datetime

        cfg: Config = app.extensions["app_config"]

        body = request.get_json(silent=True)
        if not body or not isinstance(body.get("event"), str):
            return _make_error("bad_request", "Body must be JSON with an 'event' string field.", 400)

        event_type = body["event"]
        allowed = {"decision_time", "alternative_click", "slider_change"}
        if event_type not in allowed:
            return _make_error("bad_request", f"Unknown event type '{event_type}'.", 400)

        record = {
            "ts": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            **body,
        }

        try:
            cfg.telemetry_path.parent.mkdir(parents=True, exist_ok=True)
            with open(cfg.telemetry_path, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(record) + "\n")
        except OSError as exc:
            logger.error("Failed to write telemetry event: %s", exc)
            return _make_error("internal_error", "Could not persist telemetry event.", 500)

        # Invalidate collab filter cache so new clicks are picked up.
        if event_type == "alternative_click":
            _collab_filter.reload()

        return jsonify({"ok": True}), 200

    # --- /api/scatter ---

    @app.get("/api/scatter")
    def scatter_route():
        """Return all products in a category for the Nutri × Eco scatter plot (F-43).

        Query params:
            cat  string  OFF category tag (e.g. "en:yogurts")

        Response shape:
            { category, count, products: [{code, name, nutri_numeric, eco_numeric}] }
        """
        idx: IndexStore = app.extensions["index_store"]
        if not idx.is_loaded():
            return _make_error("index_not_loaded", "Index not loaded — run build_knn_index.py first.", 503)

        cat = request.args.get("cat", "").strip()
        if not cat:
            return _make_error("missing_param", "missing required parameter: cat", 400)

        products = idx.filter_by_category(cat)

        points = []
        for p in products:
            nutri_numeric = (p.get("nutriScore") or {}).get("numeric")
            eco_numeric = (p.get("ecoScore") or {}).get("numeric")
            if nutri_numeric is None and eco_numeric is None:
                continue
            points.append({
                "code": p.get("code"),
                "name": p.get("name") or p.get("code"),
                "nutri_grade": (p.get("nutriScore") or {}).get("grade"),
                "eco_grade": (p.get("ecoScore") or {}).get("grade"),
                "nutri_numeric": nutri_numeric,
                "eco_numeric": eco_numeric,
            })

        return jsonify({"category": cat, "count": len(points), "products": points}), 200

    # --- /api/explain/<barcode> ---

    @app.get("/api/explain/<barcode>")
    def explain_route(barcode: str):
        """Return a contrastive sentence explaining a product vs. its best alternative
        (or the category average if no alternatives exist).

        Query params:
            weight  float 0..1  (default 0.7; 1 = full health, 0 = full eco)
            against barcode | 'category'  (default: auto — top-1 alternative or category avg)
        """
        idx: IndexStore = app.extensions["index_store"]
        client: OpenFoodFactsClient = app.extensions["off_client"]

        if not idx.is_loaded():
            return _make_error("index_not_loaded", "Index not loaded — run build_knn_index.py first.", 503)

        try:
            health_weight = float(request.args.get("weight", "0.7"))
            if not (0.0 <= health_weight <= 1.0):
                raise ValueError("weight out of range")
        except ValueError:
            return _make_error("invalid_param", "Parameter weight must be a float between 0 and 1.", 400)

        # --- Resolve query product ---
        query_product = idx.get_by_barcode(barcode)
        source_tag = "index"

        if query_product is None:
            try:
                raw, source_tag = client.get_product(barcode)
            except RateLimitExceeded:
                import math as _math
                wait = _math.ceil(client.bucket_for_endpoint("product").time_until_available())
                resp = _make_error("rate_limited", "Client-side rate limit reached.", 429)
                resp[0].headers["Retry-After"] = str(wait)
                return resp
            except OFFUpstreamError as exc:
                if exc.status_code == 404:
                    return _make_error("barcode_not_found", f"Barcode {barcode} not found.", 404, barcode=barcode)
                return _make_error("off_unavailable_no_index_hit", "OFF unavailable and barcode not in index.", 503)
            except OFFTimeoutError:
                return _make_error("upstream_timeout", "Upstream OFF timed out.", 504)

            if raw is None:
                return _make_error("barcode_not_found", f"Barcode {barcode} not found.", 404, barcode=barcode)

            query_product = normalise_product(raw)
            if query_product is None:
                return _make_error("barcode_not_found", f"Could not normalise product {barcode}.", 404)

        # --- SHAP waterfall (F-24) — computed before reference lookup, no dependency on index ---
        nutrients = query_product.get("nutrients") or {}
        shap_waterfall = _shap_explainer.compute_shap_waterfall(nutrients)

        # --- Determine reference ---
        # Try top-1 alternative first; fall back to category average.
        alt_result = _recommender.find_alternatives(query_product, idx, k=1, health_weight=health_weight)
        alternatives = alt_result.get("alternatives", [])

        if alternatives:
            reference_product = alternatives[0]["product"]
            reference = {
                "kind": "product",
                **reference_product,
            }
            reference_meta = {
                "kind": "product",
                "name": reference_product.get("name") or reference_product.get("code"),
            }
        else:
            # Fall back to category average.
            category = query_product.get("category")
            category_products = idx.filter_by_category(category) if category else []
            reference = _explainer.build_category_average_reference(category_products, category or "")
            if reference is None:
                # Absolute fallback — no reference available at all.
                body = {
                    "barcode": barcode,
                    "sentence": "Insufficient comparable data for this product.",
                    "hasComparison": False,
                    "reference": {"name": "category average"},
                    "factors": [],
                    "shap_waterfall": shap_waterfall,
                    "meta": {
                        "explainer_version": "shap-tree-f24" if shap_waterfall else "contrastive-stub",
                    },
                }
                resp = jsonify(body)
                resp.headers["X-Data-Source"] = source_tag
                return resp, 200
            reference_meta = {"kind": "category-average", "name": "the category average"}

        # --- Generate sentence ---
        result_sentence = _explainer.generate_contrastive_sentence(query_product, reference)

        # Build factors list for introspection.
        factors = _build_factors(query_product, reference)

        body = {
            "barcode": barcode,
            "sentence": result_sentence["sentence"],
            "hasComparison": result_sentence["hasComparison"],
            "reference": reference_meta,
            "factors": factors,
            "shap_waterfall": shap_waterfall,
            "meta": {
                "explainer_version": "shap-tree-f24" if shap_waterfall else "contrastive-stub",
            },
        }

        resp = jsonify(body)
        resp.headers["X-Data-Source"] = source_tag
        if idx.built_at():
            resp.headers["X-Index-Built-At"] = idx.built_at()
        return resp, 200

    return app


def _build_factors(product: dict, reference: dict) -> list[dict]:
    """Build a list of nutrient factor dicts for the explain response body."""
    keys = ["sugars_100g", "fat_100g", "saturatedFat_100g", "salt_100g", "proteins_100g", "fiber_100g", "energyKcal_100g"]
    p_nutrients = product.get("nutrients") or {}
    r_nutrients = reference.get("nutrients") or {}
    factors = []
    for key in keys:
        p_val = p_nutrients.get(key)
        r_val = r_nutrients.get(key)
        if isinstance(p_val, (int, float)) and isinstance(r_val, (int, float)) and r_val != 0:
            delta_pct = ((p_val - r_val) / r_val) * 100.0
            direction = "more" if delta_pct > 0 else "less"
            factors.append({
                "nutrient": key,
                "product_value": p_val,
                "reference_value": r_val,
                "delta_pct": round(delta_pct, 1),
                "direction": direction,
            })
    return factors


if __name__ == "__main__":
    cfg = load_config()
    application = create_app(cfg)
    application.run(host=cfg.flask_host, port=cfg.flask_port, debug=(cfg.flask_env == "development"))
