"""Async repository — ORM rows ↔ Pydantic domain objects.

Used by the persistence layer for write-through and startup hydration.
Keeps the in-memory store as the working set while MySQL holds the durable
copy.
"""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.dialects.mysql import insert as mysql_insert

from app.db import Base, get_engine, get_sessionmaker
from app.models import BugRow, ProjectRow, RunRow
from app.schemas import Bug, Project, TestRun


async def init_db() -> None:
    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def is_empty() -> bool:
    async with get_sessionmaker()() as s:
        row = await s.scalar(select(ProjectRow.id).limit(1))
        return row is None


async def load_all() -> tuple[list[Project], list[TestRun], list[Bug]]:
    async with get_sessionmaker()() as s:
        projects = [Project.model_validate(r.data) for r in (await s.scalars(select(ProjectRow))).all()]
        runs = [TestRun.model_validate(r.data) for r in (await s.scalars(select(RunRow))).all()]
        bugs = [Bug.model_validate(r.data) for r in (await s.scalars(select(BugRow))).all()]
    return projects, runs, bugs


async def _upsert(session, model, pk_values: dict, extra: dict) -> None:
    """Portable upsert: try MySQL ON DUPLICATE KEY, else delete+insert."""
    values = {**pk_values, **extra}
    dialect = session.bind.dialect.name if session.bind else ""
    if dialect == "mysql":
        stmt = mysql_insert(model).values(**values)
        stmt = stmt.on_duplicate_key_update(**extra)
        await session.execute(stmt)
    else:
        await session.execute(delete(model).where(model.id == pk_values["id"]))
        await session.execute(model.__table__.insert().values(**values))


async def save_project(p: Project) -> None:
    async with get_sessionmaker()() as s:
        await _upsert(s, ProjectRow, {"id": p.id}, {"url": p.url, "data": p.model_dump()})
        await s.commit()


async def save_run(r: TestRun) -> None:
    async with get_sessionmaker()() as s:
        await _upsert(s, RunRow, {"id": r.id},
                      {"project_id": r.project_id, "status": r.status,
                       "started_at": r.started_at, "data": r.model_dump()})
        await s.commit()


async def save_bugs(bugs: list[Bug]) -> None:
    if not bugs:
        return
    async with get_sessionmaker()() as s:
        for b in bugs:
            await _upsert(s, BugRow, {"id": b.id},
                          {"project_id": b.project_id, "run_id": b.run_id,
                           "severity": b.severity, "category": b.category,
                           "status": b.status, "data": b.model_dump()})
        await s.commit()
