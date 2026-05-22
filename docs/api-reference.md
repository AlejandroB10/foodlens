# API Reference — Open Food Facts (and our own conventions)

> The only external dependency FoodLens has, plus the contract `frontend/js/api.js` exposes to the rest of the app.

## At a glance

- **Base URL**: `https://world.openfoodfacts.org/api/v2/`
- **Documentation**: https://openfoodfacts.github.io/openfoodfacts-server/api/
- **Data dumps** (for offline analysis only): https://es.openfoodfacts.org/data
- **Authentication**: none. The API is public.
- **CORS**: open (`access-control-allow-origin: *`), verified with `curl -I OPTIONS`. Browsers can call directly.
- **Mandatory header**: `User-Agent`. Format: `FoodLens-MVP/0.1 (team-contact)` — without it, the API may return 403.

## Rate limits (the real ones, from the official docs)

| Endpoint | Limit | What happens at the limit |
|---|---|---|
| `GET /api/v2/product/{barcode}` | **100 requests/minute** | 429 Too Many Requests |
| `GET /api/v2/search` | **10 requests/minute** | 429 Too Many Requests |
| Anything else | **10 requests/minute** | 429 Too Many Requests |

The user originally mentioned "5 req/sec" — that was incorrect. **Use the table above.**

`api.js` enforces this client-side with a simple token bucket. The 503 mode is **not** a rate-limit response: it is OFF's actual upstream service being unstable, especially on `/search`.

## Endpoint catalogue

### `GET /api/v2/product/{barcode}`

Look up a single product by barcode (EAN-13, EAN-8, UPC, etc.).

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `barcode` | string | yes | The product's barcode. Validate length 8 or 13 client-side. |

**Query params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `fields` | string | recommended | Comma-separated list of fields to return. **Use this — without it the API returns 200+ fields you do not need.** |

**Fields we request**

```
code,product_name,brands,image_front_url,
nutriscore_grade,environmental_score_grade,ecoscore_grade,
nutrient_levels,nutriments,categories_tags
```

**Example**

```bash
curl -H 'User-Agent: FoodLens-MVP/0.1 (team@uib.cat)' \
  "https://world.openfoodfacts.org/api/v2/product/5449000131805?fields=code,product_name,brands,image_front_url,nutriscore_grade,environmental_score_grade,ecoscore_grade,nutrient_levels,nutriments,categories_tags"
```

**Response (200 OK)** — verified live, this is real shape:

```json
{
  "code": "5449000131805",
  "status": 1,
  "status_verbose": "product found",
  "product": {
    "code": "5449000131805",
    "product_name": "Coca-Cola Zero Sugar",
    "brands": "Coca-Cola",
    "image_front_url": "https://images.openfoodfacts.org/images/products/544/900/013/1805/front_en.687.400.jpg",
    "nutriscore_grade": "c",
    "ecoscore_grade": "not-applicable",
    "environmental_score_grade": null,
    "nutrient_levels": {
      "fat": "low",
      "salt": "low",
      "saturated-fat": "low",
      "sugars": "low"
    },
    "nutriments": {
      "energy-kcal_100g": 0.2,
      "fat_100g": 0,
      "saturated-fat_100g": 0,
      "sugars_100g": 0,
      "salt_100g": 0.02,
      "fiber_100g": null,
      "proteins_100g": 0
    },
    "categories_tags": [
      "en:beverages",
      "en:carbonated-drinks",
      "en:diet-cola-soft-drink"
    ]
  }
}
```

**Product not found (200 OK, `status: 0`)**

```json
{
  "code": "0000000000000",
  "status": 0,
  "status_verbose": "product not found"
}
```

This is **not an HTTP error** — it is a 200 with `status: 0`. Client must check the `status` field. Easy to miss.

**Server error**: `5xx` — fall back to `sample_products.json` lookup by code.

### `GET /api/v2/search`

Free-form product search.

**Query params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `categories_tags` | string | one of these | OFF taxonomy tag, e.g. `en:yogurts`. Most reliable filter. |
| `search_terms` | string | one of these | Full-text query over product names/brands. Less reliable. |
| `ingredients_tags` | string | no | OFF ingredient taxonomy tag, e.g. `en:almonds`. F-40 normalises simple input like `almonds` to this form. |
| `countries_tags` | string | no | Filter by country, e.g. `en:spain`. |
| `fields` | string | recommended | Same as `/product/`. |
| `page_size` | integer | no | Default 20, max 1000. Use 20–50 for the UI. |
| `page` | integer | no | 1-indexed. |

**Example**

```bash
curl -H 'User-Agent: FoodLens-MVP/0.1 (team@uib.cat)' \
  "https://world.openfoodfacts.org/api/v2/search?categories_tags=en:yogurts&page_size=20&fields=code,product_name,brands,nutriscore_grade,environmental_score_grade"
```

**Response (200 OK)**

```json
{
  "count": 12345,
  "page": 1,
  "page_count": 1,
  "page_size": 20,
  "products": [
    { "code": "...", "product_name": "...", "nutriscore_grade": "a", ... },
    ...
  ],
  "skip": 0
}
```

**Known failure mode (verified twice with live curl)**

```
HTTP/2 503
content-type: text/html
```

503 Service Unavailable is **frequent** on `/search`, especially during EU office hours. The feasibility notebook (`OFF_ML_Demo.ipynb`) reports the same behaviour: the team had to add a synthetic-data fallback to keep the demo running.

**`api.js` handles this by**:

1. Retrying once with exponential backoff (1s).
2. If still 503, loading `frontend/data/sample_products.json` and filtering client-side.
3. Setting `source: 'sample'` on every returned product so the UI can render a discreet "showing offline samples" badge.

## Score conventions

### Nutri-Score (health axis)

Computed by OFF using the official French public-health authority algorithm.

| Grade | Meaning | Colour | Numeric (our convention) |
|---|---|---|---|
| `a` | Best nutritional quality | `#2ecc71` (green) | 5 |
| `b` | Good nutritional quality | `#a8d635` (light green) | 4 |
| `c` | Average nutritional quality | `#f7b731` (yellow) | 3 |
| `d` | Poor nutritional quality | `#f39c12` (orange) | 2 |
| `e` | Very poor nutritional quality | `#e74c3c` (red) | 1 |
| `unknown` | Insufficient data on the product | `#999` (grey) | `null` |
| `not-applicable` | Category to which Nutri-Score does not apply | `#999` (grey) | `null` |

Render letter **and** colour together — colour alone fails colour-blind users.

### Environmental Score (eco axis)

Same A–E scale, methodology by ADEME (French environmental agency): carbon emissions + water + land use + packaging, aggregated.

| Grade | Meaning | Colour (ecology palette) | Numeric |
|---|---|---|---|
| `a` | Very low environmental impact | `#1b7339` (deep green) | 5 |
| `b` | Low environmental impact | `#4caf50` (mid green) | 4 |
| `c` | Moderate environmental impact | `#cddc39` (olive) | 3 |
| `d` | High environmental impact | `#ff9800` (amber) | 2 |
| `e` | Very high environmental impact | `#795548` (earth brown) | 1 |
| `unknown` | Insufficient data | `#999` | `null` |
| `not-applicable` | Score does not apply to this category | `#999` | `null` |

**Critical gotcha**: this score lives under **two different field names** in the API.

```js
function readEcoScore(product) {
  // Read the new field first
  const v = product.environmental_score_grade
  if (v) return { grade: v, sourceField: 'environmental_score_grade' }

  // Fallback to the legacy field
  const legacy = product.ecoscore_grade
  if (legacy) return { grade: legacy, sourceField: 'ecoscore_grade' }

  return { grade: 'unknown', sourceField: null }
}
```

The schema migration is mid-flight. Always check both.

### Nutrient levels (free XAI fuel)

OFF pre-classifies four nutrients into qualitative buckets. This is what `xai.js` uses to produce the contrastive sentence without needing a trained model.

| Nutrient | Bucket | Threshold (per 100g, approximate) |
|---|---|---|
| `fat` | `low` / `moderate` / `high` | ≤ 3 / ≤ 17.5 / > 17.5 g |
| `salt` | `low` / `moderate` / `high` | ≤ 0.3 / ≤ 1.5 / > 1.5 g |
| `saturated-fat` | `low` / `moderate` / `high` | ≤ 1.5 / ≤ 5 / > 5 g |
| `sugars` | `low` / `moderate` / `high` | ≤ 5 / ≤ 12.5 / > 12.5 g |

Thresholds are OFF's, not ours. If `nutrient_levels` is missing for a product, render *"no data"* chips — do not recompute.

## Sample products fallback

Lives at `frontend/data/sample_products.json`. Curated by F-03. Schema mirrors the **normalised** product shape (see `architecture.md`), not the raw OFF response — `api.js` produces the same shape regardless of source.

The team should include:

- At least 2 products per Nutri-Score grade (so 10 minimum).
- At least 5 products with valid `environmental_score_grade`.
- At least 2 products with `not-applicable` Eco-Score (beverages are easy candidates).
- At least 2 products with `unknown` Nutri-Score (rare, but they exist).
- A mix of categories: yogurts, cereals, beverages, plant-based proteins, prepared meals.

To capture a real product into the sample file:

```bash
curl -H 'User-Agent: FoodLens-MVP/0.1 (team@uib.cat)' \
  "https://world.openfoodfacts.org/api/v2/product/{barcode}?fields=code,product_name,brands,image_front_url,nutriscore_grade,environmental_score_grade,ecoscore_grade,nutrient_levels,nutriments,categories_tags" \
  | jq '.product'
```

Then normalise it to the shape documented in `architecture.md`.

## FoodLens internal API

Introduced by SDD change `backend-flask-mvp` (F-23 + F-25), 2026-05-13.

- **Base URL**: `http://localhost:5000` (development) — configurable via `<meta name="foodlens-backend-url">` in `index.html`.
- **CORS**: `Access-Control-Allow-Origin: *` (MVP-only; tighten before any deploy).
- **User-Agent** (for upstream calls to OFF): `FoodLens-Backend/0.1 (team@uib.cat)`.
- **Response format**: always `application/json; charset=utf-8` — even errors.
- **Shared response headers**:
  - `X-Data-Source`: `live-off | cache | index | sample-fallback` (on 2xx).
  - `X-Index-Built-At`: ISO-8601 timestamp (when the index is involved).
  - `Retry-After`: seconds (on 429 / 503 when applicable).

### `GET /health`

Returns backend status and index metadata.

**Response 200 (index loaded)**

```json
{
  "status": "ok",
  "index_built_at": "2026-05-13T11:42:08Z",
  "index_size": 487,
  "version": "0.1.0"
}
```

**Response 200 (no index)**

```json
{
  "status": "degraded",
  "reason": "index_not_loaded",
  "index_built_at": null,
  "index_size": 0,
  "version": "0.1.0"
}
```

---

### `GET /api/search?q=<query>`

Proxies `GET /api/v2/search` on OFF and returns normalised products.

**Query params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `q` | string | yes | Free-text search query. |

**Response 200**

```json
{
  "count": 3,
  "products": [ /* normalised product shape (see architecture.md) */ ]
}
```

**Response 400** — `q` missing.

```json
{ "error": { "code": "MISSING_PARAM", "message": "missing required parameter: q" } }
```

---

### `GET /api/product/<barcode>`

Proxies `GET /api/v2/product/{barcode}` on OFF and returns a single normalised product.

**Response 200**

```json
{ /* normalised product shape — same as array elements in /api/search */ }
```

**Response 404** — barcode not found in OFF.

```json
{ "error": { "code": "PRODUCT_NOT_FOUND", "message": "No product with barcode ... was found.", "barcode": "..." } }
```

**Response 503** — OFF unavailable.

---

### `GET /api/alternatives/<barcode>?k=3&weight=0.5`

Returns up to k strictly-better alternatives from the prebuilt KNN index.

**Query params**

| Name | Type | Default | Notes |
|---|---|---|---|
| `k` | int | 3 | Number of alternatives (1..10). |
| `weight` | float | 0.5 | Health weight (0 = full eco, 1 = full health). |

**Response 200 (alternatives found)**

```json
{
  "barcode": "5449000131805",
  "query_product": { /* normalised */ },
  "alternatives": [
    {
      "product": { /* normalised */ },
      "distance": 0.142,
      "delta_text": "4.1g less sugar, 0.6g more fibre per 100g."
    }
  ],
  "meta": {
    "reason": null,
    "pool_size": 18,
    "health_weight": 0.5,
    "k_requested": 3,
    "k_returned": 1
  }
}
```

**Response 200 (no better alternative)**

```json
{
  "barcode": "...",
  "query_product": { /* normalised */ },
  "alternatives": [],
  "meta": {
    "reason": "no_better_alternative_in_category",
    "pool_size": 12,
    "health_weight": 0.5,
    "k_requested": 3,
    "k_returned": 0
  }
}
```

`meta.reason` values:
- `null` — alternatives found.
- `"no_better_alternative_in_category"` — pool exists but no candidate passes the strict-better filter.
- `"category-not-in-index"` — fewer than 3 products in the category index.
- `"unknown_grade_on_query"` — query product has no known Nutri-Score grade.
- `"barcode_not_found"` — barcode unknown to both the index and OFF.
- `"off_unavailable_no_index_hit"` — OFF unreachable and barcode not cached.

**Response 400** — invalid `k` or `weight`.

**Response 503** — index not loaded.

---

### `GET /api/explain/<barcode>?weight=0.7`

Returns a contrastive sentence explaining the product vs. its best alternative (or the category average if none exist).

**Query params**

| Name | Type | Default | Notes |
|---|---|---|---|
| `weight` | float | 0.7 | Health weight (0 = full eco, 1 = full health). |

**Response 200**

```json
{
  "barcode": "3017624010701",
  "sentence": "This product has 100% more sugar per 100g than the category average, with a worse Nutri-Score (E vs B).",
  "hasComparison": true,
  "reference": {
    "kind": "category-average",
    "name": "the category average"
  },
  "factors": [
    {
      "nutrient": "sugars_100g",
      "product_value": 56.3,
      "reference_value": 32.4,
      "delta_pct": 73.8,
      "direction": "more"
    }
  ],
  "meta": {
    "explainer_version": "contrastive-stub",
    "for_replacement_by": "F-24-SHAP"
  }
}
```

The `sentence` is always one sentence, contains at most one percentage value, and contains no moralising language. It is a stub — SHAP-based explanations arrive in F-24.

**Response 400** — invalid `weight`.

**Response 404** — barcode not found.

**Response 503** — index not loaded.

## Versioning

This document tracks the API as of **2026-05-13**. The OFF schema is evolving (the `environmental_score_grade` rename is one example). When a teammate hits an unexpected behaviour, **update this file in the same PR** that fixes it — that is the only way the doc stays useful.
