# FoodLens

> Transparent multi-objective food recommendations: dual-axis scoring (Health + Eco) with visible, contrastive reasoning.

FoodLens is the **final deliverable** of the UIB course **11755 — Human-Computer Interaction (MUSI-IA)** project *"Transparent Multi-Objective Food Recommendations"*. It is a web application that recommends food products and **shows you why** — combining the Nutri-Score (health) and the Environmental Score (eco) into a dual-axis view, and explaining every recommendation with a single contrastive sentence anchored on a verifiable number from Open Food Facts.

The research phase (WA3) produced **5 Key Insights** and **7 Design Hooks** from 6 semi-structured interviews; this repository implements those constraints end to end — from the dual-axis UI to a Random Forest + SHAP explanation pipeline. See [`docs/architecture.md`](docs/architecture.md) and the final paper/slides under [`docs/final/`](docs/final/).

## Running the project

Three ways to run FoodLens. Pick the one that fits what you are doing.

### Mode 1 — Frontend only (30 seconds, zero setup)

The browser calls the Open Food Facts API directly; in-browser JS handles the KNN alternatives and the contrastive sentence. No Python, no Docker. **The SHAP advanced explanation and the scatter plot need the backend (Mode 2/3).**

```bash
git clone <repo-url> foodlens
cd foodlens/frontend
python3 -m http.server 8080
# open http://localhost:8080
```

### Mode 2 — Frontend + Flask backend (local, no Docker)

Adds the weighted-KNN Alternative Engine, server-side OFF caching, the `/api/explain` SHAP endpoint, and the `/api/scatter` visual XAI. Use this when working on backend features.

```bash
cd foodlens
pip install -r backend/requirements.txt

# The KNN index (backend/data/alt_index.pkl) and the SHAP model
# (backend/models/nutriscore_rf.pkl) are committed, so you can skip building them.
# To regenerate the index from live OFF data (optional):
#   python -m backend.scripts.build_knn_index

# start the backend on :5000
python -m flask --app backend.app run --host=0.0.0.0 --port=5000

# in a second terminal, serve the frontend on :8080
cd frontend && python3 -m http.server 8080
```

The frontend is already wired to the backend via `<meta name="foodlens-backend-url" content="http://localhost:5000">` in `index.html`. If the backend is unreachable, the frontend silently falls back to its in-browser path — no UI disruption.

### Mode 3 — Docker compose (all services, one command) — recommended for the full app

Brings up **redis + backend + frontend** in one command, with the real OFF cache. The committed index and model are used as-is.

```bash
cd foodlens
docker compose up --build
# Frontend on http://localhost:8080
# Backend  on http://localhost:5000  (health: /health)
```

Notes:
- The `docker-compose.yml` is ready to go: redis is mapped to host port **6380** (to avoid clashing with other local Redis containers), the backend healthcheck uses Python (the slim image has no `curl`), and telemetry writes to a writable path.
- The index `backend/data/alt_index.pkl` is mounted read-only into the backend; the model `backend/models/nutriscore_rf.pkl` is baked into the image at build time — so **after a `git pull`, run `docker compose up --build`** to pick up new code and model.
- First `--build` installs the ML stack (scikit-learn + SHAP + numpy + pandas + duckdb) — a few minutes; later builds are cached.

### Open Food Facts API contract

The backend respects OFF rate limits: 10 req/min on `/search`, 100 req/min on `/product/{barcode}`. `/search` is intermittently 503 — the backend and the build script fall back gracefully. Full details and gotchas in [`docs/api-reference.md`](docs/api-reference.md).

## Backend API

| Route | Purpose |
|---|---|
| `GET /health` | Liveness + diagnostics (index size, cache backend, model status) |
| `GET /api/products?limit&offset` | Full index catalogue (powers the listing / "All categories" instead of the 10-sample fallback) |
| `GET /api/search?...` | OFF product search proxy (cached) |
| `GET /api/product/<barcode>` | Single product (cached) |
| `GET /api/alternatives/<barcode>` | Weighted-KNN strictly-better alternatives + contrastive deltas |
| `GET /api/explain/<barcode>` | Contrastive factors + **SHAP waterfall** |
| `GET /api/scatter?cat=<tag>` | Nutri × Eco points of a category (visual XAI) |
| `POST /api/telemetry` | Opt-in usage events |

The index holds **~862 real Open Food Facts products** across ~10 categories; the Nutri-Score Random Forest reaches ~94% CV on the demo split and drives the SHAP explanations.

## Running the tests

```bash
cd foodlens
pip install -r backend/requirements-dev.txt
python3 -m pytest backend/tests/
```

Backend is covered by pytest. Frontend has Playwright specs run manually (the `frontend/tests/` suite is kept local). Manual walkthroughs follow [`docs/user-flows.md`](docs/user-flows.md).

## Stack

| Layer | Tech | Notes |
|---|---|---|
| **UI** | HTML5 + CSS3 + JavaScript (ES modules) | Zero build step. Typography: Newsreader + Bricolage Grotesque + JetBrains Mono. |
| **Backend** | Flask 3 + scikit-learn + **SHAP** + numpy + pandas + **DuckDB** | Optional but full: KNN engine, SHAP attribution, scatter, collaborative-filtering layer. |
| **Cache** | Redis (with in-process TTLCache fallback) | Keeps the backend under OFF rate limits. |
| **Data source** | Open Food Facts API v2 (REST) | Public, CORS-open. Sample fallback in `frontend/data/sample_products.json`. |
| **Containers** | Docker compose: redis + python:3.11-slim + nginx:alpine | `docker compose up --build` brings all three up. |

## How the team works

Work is split into feature batches in [`docs/feature-backlog.md`](docs/feature-backlog.md); each member runs their features through Requirements → Design → Implementation → Testing (see [`docs/contributing.md`](docs/contributing.md)).

## Repository layout

```
foodlens/
├── README.md                          ← you are here
├── CLAUDE.md  AGENTS.md               ← agent instructions
├── docker-compose.yml                 ← redis + backend + frontend
├── .env.example  .dockerignore  .gitignore
├── docs/
│   ├── architecture.md  api-reference.md  user-flows.md
│   ├── feature-backlog.md  contributing.md  conventions.md  manual-testing.md
│   ├── reqs/  design/  designs/  prototypes/  sdd/
│   └── final/                         ← paper + presentation (deck, build, demo guides)
├── frontend/
│   ├── Dockerfile  nginx.conf  index.html
│   ├── css/                           ← style.css + per-feature stylesheets
│   ├── data/sample_products.json      ← offline fallback
│   └── js/
│       ├── app.js  api.js  xai.js
│       └── views/                     ← onboarding, history, favourites, settings,
│                                         tooltips, comparison, filters, categories,
│                                         export, i18n
└── backend/
    ├── Dockerfile  README.md  config.py
    ├── requirements.txt  requirements-dev.txt
    ├── app.py                         ← Flask factory + routes
    ├── data/alt_index.pkl             ← committed KNN index (~862 real products)
    ├── models/nutriscore_rf.pkl       ← committed Random Forest (SHAP model)
    ├── services/
    │   ├── off_client.py  normaliser.py  nutriscore.py
    │   ├── index_store.py  recommender.py
    │   ├── explainer.py  shap_explainer.py
    │   ├── nutriscore_model.py  collab_filter.py
    ├── scripts/
    │   ├── build_knn_index.py         ← index builder (real OFF + synthetic fallback)
    │   └── train_nutriscore_rf.py     ← Random Forest trainer
    └── tests/                         ← pytest
```

> The KNN index and the SHAP model are **committed** (`backend/data/alt_index.pkl`, `backend/models/nutriscore_rf.pkl`) so the whole team gets the same real data with a `git pull` + `docker compose up --build`, without depending on OFF's intermittent availability. They can be regenerated with the scripts above when OFF is reachable.

## Team & roles

Delivered by the WA3 team (4 members):

| Name | Area | Feature batch |
|---|---|---|
| **Alejandro Rafael Bordón Duarte** | Frontend UX lead | Onboarding, recently-viewed, favourites + routing, settings, tooltips, share, print, personas |
| **Soufyane Youbi** (Sufi) | ML / backend / XAI lead | Flask backend, Random Forest, SHAP, scatter, collaborative filtering, Redis, telemetry |
| **Alejandro Rodríguez Arguimbau** | Integrations + evaluation | Barcode scan, PWA, dark mode, WCAG, ingredient search, seasonal hints, SUS + ESS forms |
| **Pau Girón Rodríguez** | Comparison + filtering | Multi-criteria + allergen filters, category browser, compare-shelf, comparison table, CSV export, i18n |

## Personas the app serves

From the WA3 user research (six semi-structured interviews, thematic analysis):

- **Marc Vidal** — Time-Strapped Pragmatist (software engineer, ~25, will not configure)
- **Pau Estarellas** — Sceptical Analyst (maths undergrad, ~22, demands verifiable numbers and the drill-down)
- **Lluís Tomàs** — Autonomous Planner (anti-greenwashing, anti-moralising, wants quick visual graphs)
- **Aina Servera** — Convenience Seeker (time- and budget-bound, hard boundary against guilt-inducing UX)

See [`docs/user-flows.md`](docs/user-flows.md) for how each persona interacts with the app.

## References

- **Final paper & slides**: [`docs/final/`](docs/final/)
- **Open Food Facts API docs**: https://openfoodfacts.github.io/openfoodfacts-server/api/
- **Open Food Facts data dumps**: https://world.openfoodfacts.org/data

## License

Academic project, UIB MUSI-IA 2025/2026. Internal use.
