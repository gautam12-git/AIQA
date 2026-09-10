"""SQLAlchemy ORM models for MySQL persistence.

Pragmatic shape for a QA tool: a few indexed scalar columns for filtering,
plus a `data` JSON column holding the full serialized domain object. Reads
reconstruct the Pydantic model from `data`; no brittle column-by-column
mapping of deeply-nested evidence/coverage/phases.
"""

from __future__ import annotations

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ProjectRow(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    url: Mapped[str] = mapped_column(String(512), index=True)
    data: Mapped[dict] = mapped_column(JSON)


class RunRow(Base):
    __tablename__ = "runs"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    started_at: Mapped[str] = mapped_column(String(40))
    data: Mapped[dict] = mapped_column(JSON)


class BugRow(Base):
    __tablename__ = "bugs"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(64), index=True)
    run_id: Mapped[str] = mapped_column(String(64), index=True)
    severity: Mapped[str] = mapped_column(String(8), index=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    data: Mapped[dict] = mapped_column(JSON)
