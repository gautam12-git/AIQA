"""Shared API dependencies — the session guard for protected endpoints."""

from __future__ import annotations

from fastapi import HTTPException, Request

from app.services import user_auth as ua

_COOKIE = "aiqa_session"


async def require_user(request: Request) -> dict:
    """Require a valid session (JWT cookie, or Bearer header). 401 otherwise."""
    token = request.cookies.get(_COOKIE)
    if not token:
        header = request.headers.get("authorization", "")
        if header.lower().startswith("bearer "):
            token = header[7:]
    payload = ua.decode_token(token) if token else None
    if not payload:
        raise HTTPException(
            status_code=401,
            detail={"code": "unauthorized", "message": "Authentication required."},
        )
    return {"id": payload.get("sub"), "email": payload.get("email")}
