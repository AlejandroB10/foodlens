FROM python:3.11-slim

# No C compiler dependencies — all packages in requirements.txt are pure-Python
# or have pre-built wheels for python:3.11-slim.

WORKDIR /app

# Install dependencies first (layer-cached until requirements.txt changes).
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend package.
COPY backend/ ./backend/

# alt_index.pkl is NOT baked into the image — it is mounted at runtime as a
# read-only volume from the host (see docker-compose.yml).
# The data directory must exist for the mount point.
RUN mkdir -p ./backend/data

EXPOSE 5000

# Use Flask's development server (single-worker, not gunicorn — see design D3).
# NOT thread-safe — single-worker only (see TTLCache / TokenBucket comments).
ENV FLASK_APP=backend.app
ENV PYTHONUNBUFFERED=1

CMD ["flask", "--app", "backend.app", "run", "--host=0.0.0.0", "--port=5000"]
