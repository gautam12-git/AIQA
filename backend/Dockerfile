# AIQA backend — FastAPI + Playwright/Chromium.
# Runs as a persistent container (Railway/Render/Fly) — NOT serverless, because
# autonomous scans drive a real browser for minutes at a time.

FROM python:3.12-slim

WORKDIR /app

# Install Python deps, then the Chromium browser + all its OS libraries.
# `--with-deps` pulls the apt packages Chromium needs on Debian slim.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m playwright install --with-deps chromium

# App code. See .dockerignore — .venv/.env/evidence/__pycache__ are excluded.
COPY . .

ENV PYTHONUNBUFFERED=1

# Railway (and most PaaS) inject $PORT; default to 8010 for local `docker run`.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8010}"]
