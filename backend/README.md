# FoodLens Backend

Flask backend for the FoodLens nutrition alternatives engine.
Provides proxy endpoints for Open Food Facts and a KNN-based alternative recommender.

## Run

```bash
# Install dependencies (Python 3.11+)
pip install -r backend/requirements.txt

# Copy and edit the env file (all defaults work without editing)
cp backend/.env.example backend/.env

# Start the server
python backend/app.py
# or
flask --app backend.app:create_app run --port 5000
```

The backend binds to `http://0.0.0.0:5000`. Set `FLASK_PORT` in `.env` to change the port.

## Build the KNN index

The alternatives engine requires a pre-built index. Build it before first use:

```bash
python -m backend.scripts.build_knn_index --output backend/data/alt_index.pkl
```

Or to force the synthetic fallback (no OFF network access needed):

```bash
python -m backend.scripts.build_knn_index --output backend/data/alt_index.pkl --synthetic-fallback
```

The index is excluded from git (`backend/data/*.pkl` in `.gitignore`). Rebuild whenever OFF data needs refreshing.

## Run tests

```bash
pip install -r backend/requirements-dev.txt
pytest backend/tests/
```

## Gotchas

**Index missing on first run.** `/health` returns `{"status": "degraded"}` when no index file is found. Build it first with the command above.

**OFF 503 during index build.** The builder automatically falls back to a synthetic product pool and exits 0. The resulting index is valid but contains synthetic data only.

**Port collision.** If port 5000 is already in use (common on macOS with AirPlay), set `FLASK_PORT=5001` in `backend/.env`.

**Single-worker warning.** The built-in Flask dev server is single-threaded. `TTLCache` and `TokenBucket` are NOT thread-safe. Do not run with `--threaded` or multi-worker gunicorn until these are replaced.

**Frontend activation.** The frontend uses the JS KNN fallback by default. To enable backend alternatives, add to `frontend/index.html`:
```html
<meta name="foodlens-backend-url" content="http://localhost:5000">
```
