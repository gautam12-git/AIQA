"""AIQA API — FastAPI app implementing CONTRACT.md.

Run locally:
    cd aiqa/backend
    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8000

Then point the frontend at it: set NEXT_PUBLIC_USE_MOCK=false in aiqa/.env.local
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import bugs, code_reviews, dashboard, health, projects, repo_reviews, runs, scans
from app.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Connect to MySQL if reachable; hydrate the store (else stay in-memory).
    from app import persistence, store
    await persistence.startup()
    # Purge evidence dirs whose run no longer exists — only when the DB is the
    # source of truth, so an in-memory session doesn't wipe live screenshots.
    if persistence.active():
        try:
            import shutil
            known = {r.id for r in store.RUNS}
            if os.path.isdir(_EVIDENCE_DIR):
                for name in os.listdir(_EVIDENCE_DIR):
                    path = os.path.join(_EVIDENCE_DIR, name)
                    if os.path.isdir(path) and name not in known:
                        shutil.rmtree(path, ignore_errors=True)
        except Exception:
            pass
    yield


app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request, exc: HTTPException):
    """Shape every error as the contract's { error: { code, message } }."""
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        body = {"error": detail}
    else:
        body = {"error": {"code": "error", "message": str(detail)}}
    return JSONResponse(status_code=exc.status_code, content=body)


for router in (health, dashboard, projects, runs, bugs, scans, code_reviews, repo_reviews):
    app.include_router(router.router, prefix="/api")

# Serve captured screenshots (evidence) so the report can show them inline.
_EVIDENCE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "evidence")
os.makedirs(_EVIDENCE_DIR, exist_ok=True)
app.mount("/evidence", StaticFiles(directory=_EVIDENCE_DIR), name="evidence")


@app.get("/")
async def root():
    return {"name": settings.app_name, "version": settings.version, "docs": "/docs"}
