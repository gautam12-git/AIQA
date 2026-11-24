# AIQA backend — FastAPI + Playwright/Chromium.
# Runs as a persistent container (Railway/Render/Fly) — NOT serverless, because
# autonomous scans drive a real browser for minutes at a time.

FROM python:3.12-slim

WORKDIR /app

# Install the library needed by Playwright's Node driver, Python deps, then
# Chromium and its remaining OS dependencies.
COPY requirements.txt .
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates \
        libatomic1 \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r requirements.txt \
    && python -m playwright install --with-deps chromium

# App code. See .dockerignore — .venv/.env/evidence/__pycache__ are excluded.
COPY . .

ENV PYTHONUNBUFFERED=1

# Railway (and most PaaS) inject $PORT; default to 8010 for local `docker run`.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8010}"]
