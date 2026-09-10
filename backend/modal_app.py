"""Modal deployment for the AIQA backend.

Deploy:
    cd aiqa/backend
    modal deploy modal_app.py

Secrets: create a Modal secret named `aiqa-secrets` holding GLM_API_KEY
(and optionally GLM_BASE_URL, GLM_MODEL, DATABASE_URL). It is mounted as
env vars, which app/config.py reads — no secret ever lives in code.

    modal secret create aiqa-secrets GLM_API_KEY=... GLM_MODEL=...

Two surfaces:
  - `api`         → the FastAPI app (this contract).
  - `browser_worker` (stub) → sandboxed Playwright/Chromium for the
    orchestrator to drive. Kept separate so exploration scales
    independently of the API.
"""

from __future__ import annotations

import modal

# API image: FastAPI + deps.
api_image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "fastapi>=0.115", "uvicorn[standard]>=0.30", "pydantic>=2.7",
    "pydantic-settings>=2.3", "httpx>=0.27",
).add_local_python_source("app")

# Worker image: adds Chromium for the browser tool layer.
worker_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("playwright>=1.47", "httpx>=0.27")
    .run_commands("playwright install --with-deps chromium")
    .add_local_python_source("app")
)

app = modal.App("aiqa")

try:
    secrets = [modal.Secret.from_name("aiqa-secrets")]
except Exception:  # secret not created yet — deploy still imports
    secrets = []


@app.function(image=api_image, secrets=secrets, min_containers=1)
@modal.asgi_app()
def api():
    from app.main import app as fastapi_app
    return fastapi_app


@app.function(image=worker_image, secrets=secrets, timeout=1800)
async def browser_worker(run_id: str, target_url: str) -> dict:
    """Sandboxed browser session for one exploration unit.

    TODO(agent): launch Chromium, drive the tool layer (open_page, click,
    inspect_dom, read_network, screenshot, …), stream evidence back to the
    orchestrator. Stub returns an empty result so the wiring imports clean.
    """
    return {"runId": run_id, "targetUrl": target_url, "findings": []}
