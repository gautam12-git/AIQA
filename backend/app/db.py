"""Database connection layer — MySQL (`aiqa` @ localhost) via async SQLAlchemy.

The engine/session live here; ORM models and the repository that replaces
the in-memory `store.py` are the next step (see CONTRACT.md → backend-owned).

Nothing connects at import time — the engine is created lazily so the app
(and the mock-backed API) runs even when MySQL isn't up yet.
"""

from __future__ import annotations

from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    """Declarative base for future ORM models (Project, TestRun, Bug, …)."""


@lru_cache
def get_engine() -> AsyncEngine:
    settings = get_settings()
    return create_async_engine(settings.sqlalchemy_url, pool_pre_ping=True, future=True)


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_session() -> AsyncSession:
    """FastAPI dependency: yields a session per request."""
    async with get_sessionmaker()() as session:
        yield session


async def ping() -> bool:
    """True if MySQL answers. Used by the health endpoint."""
    from sqlalchemy import text

    try:
        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
