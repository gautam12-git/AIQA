"""AIQA API — FastAPI app implementing CONTRACT.md.

Run locally:
    cd aiqa/backend
    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8000

Then point the frontend at it: set NEXT_PUBLIC_USE_MOCK=false in aiqa/.env.local
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

log = logging.getLogger("aiqa.api")

from app.api import accounts, bugs, code_reviews, dashboard, health, projects, repo_reviews, runs, scans
from app.api.deps import require_user
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


# Polite, user-facing fallbacks per status — never leak internals or raw
# framework strings. A route may still pass its own {code,message}.
_FRIENDLY_STATUS: dict[int, tuple[str, str]] = {
    400: ("bad_request", "That request couldn't be processed. Please check your input and try again."),
    401: ("unauthorized", "Please sign in to continue."),
    403: ("forbidden", "You don't have access to that."),
    404: ("not_found", "We couldn't find what you were looking for."),
    405: ("method_not_allowed", "That action isn't allowed here."),
    408: ("timeout", "That took too long. Please try again."),
    409: ("conflict", "That conflicts with something that already exists."),
    413: ("too_large", "That's too large to process. Please try something smaller."),
    429: ("rate_limited", "You're going a little fast — please wait a moment and try again."),
    503: ("unavailable", "The service is busy right now. Please try again shortly."),
}
_GENERIC = ("error", "Something went wrong. Please try again.")
# Raw framework defaults we should replace with a friendly message.
_FRAMEWORK_DEFAULTS = {"not found", "internal server error", "method not allowed", ""}


@app.exception_handler(HTTPException)
async def http_exception_handler(_request, exc: HTTPException):
    """Shape every HTTP error as the contract's { error: { code, message } }."""
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        return JSONResponse(status_code=exc.status_code, content={"error": detail})
    code, friendly = _FRIENDLY_STATUS.get(exc.status_code, _GENERIC)
    # Keep a meaningful custom string, but replace bare framework defaults.
    if isinstance(detail, str) and detail.strip().lower() not in _FRAMEWORK_DEFAULTS:
        message = detail
    else:
        message = friendly
    return JSONResponse(status_code=exc.status_code, content={"error": {"code": code, "message": message}})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request, _exc: RequestValidationError):
    """422 from request validation → a polite, non-technical message."""
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "invalid_request",
                           "message": "Some of the information sent wasn't valid. Please check and try again."}},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    """Last resort: log the real error server-side, return a calm message."""
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "internal_error",
                           "message": "Something went wrong on our end. We've logged it — please try again in a moment."}},
    )


# Public routers: health checks and auth (login/signup/etc.).
for router in (health, accounts):
    app.include_router(router.router, prefix="/api")

# Protected routers: require a valid session for every route.
for router in (dashboard, projects, runs, bugs, scans, code_reviews, repo_reviews):
    app.include_router(router.router, prefix="/api", dependencies=[Depends(require_user)])


# Catch-all for unknown /api paths → the contract's friendly 404 envelope
# (registered last, so it never shadows a real route).
@app.api_route("/api/{_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
               include_in_schema=False)
async def _api_not_found(_path: str):
    raise HTTPException(
        status_code=404,
        detail={"code": "not_found", "message": "We couldn't find what you were looking for."},
    )

# Serve captured screenshots (evidence) so the report can show them inline.
_EVIDENCE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "evidence")
os.makedirs(_EVIDENCE_DIR, exist_ok=True)
app.mount("/evidence", StaticFiles(directory=_EVIDENCE_DIR), name="evidence")


@app.get("/")
async def root():
    return {"name": settings.app_name, "version": settings.version, "docs": "/docs"}
