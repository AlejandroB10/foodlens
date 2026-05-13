# FoodLens

> Transparent multi-objective food recommendations: dual-axis scoring (Health + Eco) with visible reasoning.

FoodLens is the WA4 prototype of the UIB course **11755 — Human-Computer Interaction (MUSI-IA)** project *"Transparent Multi-Objective Food Recommendations"*. It is a web application that recommends food products and **shows you why** — combining the Nutri-Score (health) and the Environmental Score (eco) into a dual-axis view with contrastive explanations.

The research phase (WA3) produced 5 key insights and 7 design hooks from 6 semi-structured interviews. This repository implements those constraints. See [`docs/architecture.md`](docs/architecture.md) for the technical translation.

## Running the project

There are **three ways** to run FoodLens. Pick the one that fits what you are doing.

### Mode 1 — Frontend only (30 seconds, zero setup)

The fastest way. The browser calls the Open Food Facts API directly; in-browser JS handles the KNN alternatives and contrastive XAI. No Python, no Docker.

```bash
git clone <repo-url> foodlens
cd foodlens/frontend
python3 -m http.server 8080
# open http://localhost:8080
```

Or open `frontend/index.html` with a double click. That is it. **Use this mode for any UI feature work.**

### Mode 2 — Frontend + Flask backend (local, no Docker)

Adds the KNN engine over a pre-built index of ~500 products, server-side OFF caching, and the `/api/explain` endpoint. Use this when you are working on backend features (F-23 area) or testing the backend integration path.

```bash
# 1) install backend deps
cd foodlens
pip install -r backend/requirements.txt
pip install -r backend/requirements-dev.txt   # only if you plan to run the tests

# 2) build the KNN index once (writes backend/data/alt_index.pkl)
python -m backend.scripts.build_knn_index

# 3) start the backend on :5000
python -m flask --app backend.app run --host=0.0.0.0 --port=5000

# 4) in a second terminal, start the frontend on :8080
cd frontend
python3 -m http.server 8080

# 5) tell the frontend to use the backend:
#    open frontend/index.html and UNCOMMENT this line in <head>:
#    <meta name="foodlens-backend-url" content="http://localhost:5000">
```

If the backend is unreachable or the meta tag is commented out, the frontend silently falls back to its in-browser path — no UI disruption.

### Mode 3 — Docker compose (both services, one command)

Same as Mode 2 but containerised. Use this when you want a reproducible environment without installing Python locally.

```bash
# 1) build the KNN index on the host (mounted read-only into the container)
pip install -r backend/requirements.txt
python -m backend.scripts.build_knn_index

# 2) copy the env template
cp .env.example .env

# 3) bring both services up
docker compose up --build
# Backend on http://localhost:5000
# Frontend on http://localhost:8080
```

The backend mounts `./backend/data` read-only inside the container, so the host-built `alt_index.pkl` is visible to the running service. Rebuild the index on the host whenever you want fresh data.

### Open Food Facts API contract

The backend calls OFF respecting the official rate limits: 10 req/min on `/search`, 100 req/min on `/product/{barcode}`. The frontend in Mode 1 calls OFF directly (CORS is open). For full details, gotchas, and example JSON, see [`docs/api-reference.md`](docs/api-reference.md).

## Running the tests

```bash
cd foodlens
pip install -r backend/requirements-dev.txt
python3 -m pytest backend/tests/
# 203 passing as of 2026-05-13
```

There are no automated tests for the frontend yet (manual walkthrough via the user-flows in `docs/user-flows.md`). Adding Playwright is a future feature.

## Stack

| Layer | Tech | Why |
|---|---|---|
| **UI** | HTML5 + CSS3 + JavaScript (ES modules) | Zero build step; any teammate can run it. No framework lock-in. Typography: Newsreader + Bricolage Grotesque + JetBrains Mono. |
| **Backend** | Flask 3 + scikit-learn + numpy + pandas | Optional. Powers KNN over the pre-built index and the `/api/explain` stub. Frontend works without it. |
| **Data source** | Open Food Facts API v2 (REST) | Public, CORS-open, covers Nutri-Score and Environmental Score. Sample fallback in `frontend/data/sample_products.json`. |
| **Containers** | Docker (python:3.11-slim + nginx:alpine) | Two services, no reverse proxy. `docker compose up` brings both up. |
| **Future** | SHAP, DuckDB over the full OFF CSV | Reserved for F-24 (server-side explanations) and beyond. Not shipped today. |

## How the team works

We split the work into **24 features** ([`docs/feature-backlog.md`](docs/feature-backlog.md)) and each member picks one and runs it through the **four phases**:

1. **Requirements** — write the user story and acceptance criteria
2. **Design** — sketch / mockup / spec the UI or contract
3. **Implementation** — write the code
4. **Testing** — manual walkthrough + assertion-style checks

Read [`docs/contributing.md`](docs/contributing.md) before picking up your first feature.

## Repository layout

```
foodlens/
├── README.md                          ← you are here
├── CLAUDE.md                          ← instructions for Claude Code
├── AGENTS.md                          ← same, for other AI agents
├── .gitignore
├── .dockerignore
├── .env.example                       ← docker-compose env template
├── docker-compose.yml                 ← 2 services: backend + frontend
├── docs/
│   ├── architecture.md                ← current architecture, decisions
│   ├── api-reference.md               ← OFF API + FoodLens internal API
│   ├── user-flows.md                  ← 3 flows × 3 personas
│   ├── feature-backlog.md             ← 24 features to pick from
│   ├── contributing.md                ← branching, PRs, 4 phases
│   └── conventions.md                 ← naming, code style, commits
├── frontend/
│   ├── Dockerfile                     ← nginx:alpine
│   ├── nginx.conf
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── app.js                     ← entrypoint, DOM wiring
│   │   ├── api.js                     ← OFF client + optional backend call
│   │   └── xai.js                     ← contrastive sentence generator
│   └── data/sample_products.json      ← offline fallback (10 products)
└── backend/
    ├── Dockerfile                     ← python:3.11-slim
    ├── README.md                      ← backend-specific notes
    ├── requirements.txt
    ├── requirements-dev.txt
    ├── .env.example
    ├── app.py                         ← Flask factory + 5 routes
    ├── config.py
    ├── data/                          ← alt_index.pkl lives here (gitignored)
    ├── services/
    │   ├── off_client.py              ← OFF HTTP client + TTL cache + token bucket
    │   ├── normaliser.py              ← raw OFF → normalised shape (parity with js/api.js)
    │   ├── nutriscore.py              ← grade ↔ numeric, colour mapping
    │   ├── index_store.py             ← KNN index loader
    │   ├── recommender.py             ← KNN + strict-better filter
    │   └── explainer.py               ← Python port of js/xai.js
    ├── scripts/
    │   └── build_knn_index.py         ← offline index builder + synthetic fallback
    └── tests/                         ← pytest, 203 tests passing
```

## Team & roles

The project is delivered by the WA3 team (P1–P4 + Sufi):

| Code | Name | WA3 role | WA4 ownership (to fill in) |
|---|---|---|---|
| P1 | **Alejandro Rafael Bordón Duarte** | Scope & State of the Art | _features TBD_ |
| P2 | **Pau Girón Rodríguez** | Methodology & Participants | _features TBD_ |
| P3 | **Alejandro Rodríguez Arguimbau** | Data Analysis | _features TBD_ |
| P4 | **Soufyane Youbi** (Sufi) | Technical feasibility (Appendix C) + Personas | _features TBD_ |

Each member writes their assigned features in [`docs/feature-backlog.md`](docs/feature-backlog.md) under the "Owner" column.

## Personas the MVP serves

From the WA3 user research (six semi-structured interviews, thematic analysis):

- **Marc Vidal** — Time-Strapped Pragmatist (P01, software engineer, ~25, high tech proficiency)
- **Pau Estarellas** — Sceptical Analyst (P02, maths undergrad, ~22, demands verifiable numbers)
- **Lluís Tomàs** — Marketing-Aware Indulger (P03, deferred from WA3, completed in WA4)

See [`docs/user-flows.md`](docs/user-flows.md) for how each persona interacts with the app.

## References

- **WA3 paper**: `../Assignments/03-assignment/Transparent_MultiObjective_Food_Recommendations_Project_Scope_and_Initial_User_Research.pdf`
- **Assignment brief (WA4)**: `../Assignments/03-assignment/HCI-2026-Project.pdf`
- **Feasibility notebook**: `../Assignments/03-assignment/OFF_ML_Demo.ipynb`
- **Open Food Facts API docs**: https://openfoodfacts.github.io/openfoodfacts-server/api/
- **Open Food Facts data dumps**: https://es.openfoodfacts.org/data

## License

Academic project, UIB MUSI-IA 2025/2026. Internal use.
