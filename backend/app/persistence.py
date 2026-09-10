"""Persistence facade — MySQL durability over the in-memory working set.

Strategy (low-risk, read paths untouched):
  - Startup: if MySQL is reachable, create tables. If empty, seed it from the
    in-memory store; otherwise hydrate the store FROM MySQL (survives restart).
  - Write-through: run/bug/project writes are mirrored to MySQL.
  - If MySQL is unreachable, everything falls back to in-memory transparently.

The store stays the fast read cache; MySQL is the source of truth when active.
"""

from __future__ import annotations

import logging

from app import store
from app.schemas import Bug, Project, TestRun

log = logging.getLogger("aiqa.persistence")

_active = False


def active() -> bool:
    return _active


async def startup() -> None:
    global _active
    try:
        from app import repository
        from app.config import get_settings
        await repository.init_db()
        if not await repository.is_empty():
            projects, runs, bugs = await repository.load_all()
            _replace(store.PROJECTS, projects)
            _replace(store.RUNS, runs)
            _replace(store.BUGS, bugs)
            log.info("Hydrated store from MySQL: %d projects, %d runs, %d bugs.",
                     len(projects), len(runs), len(bugs))
        elif get_settings().seed_demo:
            # Seed the fresh database from the in-memory demo data.
            for p in store.PROJECTS:
                await repository.save_project(p)
            await repository.save_bugs(list(store.BUGS))
            for r in store.RUNS:
                await repository.save_run(r)
            log.info("Seeded MySQL from demo data (SEED_DEMO=true).")
        else:
            # Real instance, empty DB: start clean (drop the in-memory demo seed).
            _replace(store.PROJECTS, [])
            _replace(store.RUNS, [])
            _replace(store.BUGS, [])
            log.info("Empty database, SEED_DEMO=false — starting clean.")
        _active = True
    except Exception as exc:  # MySQL down / not configured → stay in-memory
        _active = False
        # Don't serve the built-in demo seed as if it were real data on a
        # broken-DB instance. Keep it only when demo mode is explicitly on.
        try:
            from app.config import get_settings
            if not get_settings().seed_demo:
                _replace(store.PROJECTS, [])
                _replace(store.RUNS, [])
                _replace(store.BUGS, [])
        except Exception:
            pass
        log.warning("Persistence inactive (in-memory only): %s", exc)


async def persist_project(p: Project) -> None:
    if not _active:
        return
    try:
        from app import repository
        await repository.save_project(p)
    except Exception as exc:
        log.warning("persist_project failed: %s", exc)


async def persist_run(r: TestRun) -> None:
    if not _active:
        return
    try:
        from app import repository
        await repository.save_run(r)
    except Exception as exc:
        log.warning("persist_run failed: %s", exc)


async def persist_bugs(bugs: list[Bug]) -> None:
    if not _active:
        return
    try:
        from app import repository
        await repository.save_bugs(bugs)
    except Exception as exc:
        log.warning("persist_bugs failed: %s", exc)


def _replace(target: list, items: list) -> None:
    target.clear()
    target.extend(items)
