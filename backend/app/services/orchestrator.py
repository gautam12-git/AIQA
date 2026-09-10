"""Run orchestrator — drives a real scan today (deterministic slice).

Pipeline (vision §46), the deterministic core of it working now:

    discover (crawl)  →  detect  →  verify by replay  →  record

The LLM-driven exploration/planning and the browser *interaction* tools
(click/type/workflows) layer on top of this same substrate next; the
evidence + verification discipline is already here.

Budgets keep the crawl bounded per mode.
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone

from app import store
from app.llm.agent import explore
from app.llm.client import get_llm
from app.schemas import Coverage, CoverageMetric, RunPhase
from app.services.access_control import check_broken_access
from app.services.appmap import build_app_map
from app.services.auth import authenticate
from app.services.browser import scan_pages
from app.services.detectors import run_detectors
from app.services.session import BrowserSession
from app.services.verifier import verify

_PAGE_BUDGET = {
    "quick": 8, "standard": 20, "deep": 40,
    "security": 15, "business-logic": 15, "full-autonomous": 30,
}

_EVIDENCE_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "evidence")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _phase(run, name: str, status: str, detail: str | None = None) -> None:
    for p in run.phases:
        if p.name == name:
            p.status = status
            if detail:
                p.detail = detail


def _cancelled(run) -> bool:
    return run.status == "cancelled"


async def launch_run(run_id: str, credentials: list | None = None) -> None:
    run = store.get_run(run_id)
    if run is None:
        return
    if _cancelled(run):  # cancelled while still queued
        return
    project = store.get_project(run.project_id)
    start_url = project.url if project else None
    if not start_url:
        run.status = "failed"
        return

    llm_on = get_llm().configured
    do_auth = bool(credentials)

    run.status = "running"
    phases = []
    if do_auth:
        phases.append(RunPhase(name="Authenticate", status="active"))
    phases += [
        RunPhase(name="Discover application", status="pending" if do_auth else "active"),
        RunPhase(name="Detect & collect evidence", status="pending"),
        RunPhase(name="AI-guided exploration", status="pending",
                 detail=None if llm_on else "skipped — LLM not configured"),
        RunPhase(name="Access control checks", status="pending",
                 detail=None if do_auth else "skipped — no credentials"),
        RunPhase(name="Verify by replay", status="pending"),
        RunPhase(name="Generate report", status="pending"),
    ]
    run.phases = phases
    t0 = time.monotonic()
    shot_dir = os.path.join(_EVIDENCE_ROOT, run_id)
    surfaced: list = []  # defined up-front so the finally block is always safe

    try:
        # 0) Authenticate (if credentials were supplied).
        storage_state = None
        if do_auth:
            cred = credentials[0]
            user = cred.get("username") if isinstance(cred, dict) else getattr(cred, "username", "")
            pw = cred.get("password") if isinstance(cred, dict) else getattr(cred, "password", "")
            storage_state, detail = await authenticate(start_url, user or "", pw or "")
            _phase(run, "Authenticate", "done", detail)
            _phase(run, "Discover application", "active")

        # 1) Discover — crawl same-origin pages (authenticated if we have a session).
        budget = _PAGE_BUDGET.get(run.mode, 15)
        reports = await scan_pages(start_url, max_pages=budget, screenshot_dir=shot_dir,
                                   storage_state=storage_state)
        run.actions_executed = len(reports)
        run.progress = 25
        crawled_note = f"{len(reports)} pages crawled" + (" (authenticated)" if storage_state else "")
        _phase(run, "Discover application", "done", crawled_note)
        if _cancelled(run):
            return  # user cancelled — the finally block records the cancelled run

        # Record page → screenshot map for on-demand visual UI analysis.
        store.set_run_pages(run_id, [
            {"url": r.url, "screenshot": os.path.basename(r.screenshot_path)}
            for r in reports if r.screenshot_path
        ])

        # 2) Detect (deterministic, always).
        _phase(run, "Detect & collect evidence", "active")
        bugs = run_detectors(reports, run_id, run.project_id, run.environment)
        run.progress = 50
        _phase(run, "Detect & collect evidence", "done", f"{len(bugs)} candidates")
        if _cancelled(run):
            return

        # 3) AI-guided exploration (only when the LLM is configured).
        if llm_on and run.mode != "quick":
            _phase(run, "AI-guided exploration", "active")
            try:
                candidates = await _run_agent(start_url, run, shot_dir, storage_state)
                bugs.extend(candidates)
                _phase(run, "AI-guided exploration", "done", f"{len(candidates)} proposed")
            except Exception as exc:  # never fail the run on agent error
                _phase(run, "AI-guided exploration", "done", f"error: {str(exc)[:60]}")
        else:
            _phase(run, "AI-guided exploration", "done",
                   "skipped — LLM not configured" if not llm_on else "skipped in quick mode")
        run.progress = 70

        # 3.5) Access control checks (only when authenticated).
        if do_auth and storage_state:
            _phase(run, "Access control checks", "active")
            try:
                bac = await check_broken_access(reports, run_id, run.project_id, run.environment)
                bugs.extend(bac)
                _phase(run, "Access control checks", "done", f"{len(bac)} access issue(s)")
            except Exception as exc:
                _phase(run, "Access control checks", "done", f"error: {str(exc)[:60]}")
        elif do_auth:
            _phase(run, "Access control checks", "done", "skipped — login failed")
        run.progress = 78

        if _cancelled(run):
            return

        # 4) Verify by replay — drop what won't reproduce.
        #    Replays carry the authenticated session so findings on protected
        #    pages reproduce instead of redirecting to login.
        _phase(run, "Verify by replay", "active")
        await verify(bugs, storage_state)
        surfaced = [b for b in bugs if b.confidence != "low"]
        run.progress = 90
        _phase(run, "Verify by replay", "done",
               f"{len(surfaced)} surfaced, {len(bugs) - len(surfaced)} dropped")

        # 4.5) Regression — compare against the project's previous completed run.
        try:
            prev = next((r for r in store.list_runs(run.project_id)
                         if r.id != run_id and r.status == "completed"), None)
            if prev:
                from app.services.regression import mark_regressions
                prev_bugs = store.list_bugs(run_id=prev.id)
                prev_urls = [p["url"] for p in store.get_run_pages(prev.id)]
                mark_regressions(surfaced, prev_bugs, prev_urls)
        except Exception:
            pass

        # 5) Record
        store.add_bugs(surfaced)
        store.recount_project(run.project_id)
        store.APP_MAPS[run.project_id] = build_app_map(start_url, reports, surfaced)
        run.bug_counts = _counts(surfaced)
        run.coverage = _coverage(reports)
        _phase(run, "Generate report", "done")
        if not _cancelled(run):  # a late cancel still wins
            run.status = "completed"
            run.progress = 100
    except Exception as exc:  # keep the run record coherent on failure
        run.status = "failed"
        _phase(run, "Generate report", "done", f"error: {exc}")
        surfaced = []
    finally:
        run.finished_at = _now()
        run.duration_ms = int((time.monotonic() - t0) * 1000)
        # Write-through to MySQL (no-op if persistence inactive).
        from app import persistence
        await persistence.persist_run(run)
        await persistence.persist_bugs(surfaced)
        project = store.get_project(run.project_id)
        if project:
            await persistence.persist_project(project)


_AGENT_STEPS = {"standard": 10, "deep": 18, "security": 14, "business-logic": 16, "full-autonomous": 20}


async def _run_agent(start_url: str, run, shot_dir: str, storage_state: dict | None = None):
    session = BrowserSession(environment=run.environment, screenshot_dir=shot_dir,
                             storage_state=storage_state)
    await session.start()
    try:
        return await explore(
            start_url=start_url, environment=run.environment, mode=run.mode,
            instruction=run.instruction, run_id=run.id, project_id=run.project_id,
            session=session, max_steps=_AGENT_STEPS.get(run.mode, 10),
        )
    finally:
        await session.close()


def _counts(bugs) -> dict[str, int]:
    c = {"P0": 0, "P1": 0, "P2": 0, "P3": 0}
    for b in bugs:
        c[b.severity] += 1
    return c


def _coverage(reports):
    pages = len(reports)
    api_hits = {r.url for rep in reports for r in rep.resources if r.resource_type in ("xhr", "fetch")}
    links = {l for rep in reports for l in rep.links}
    buttons_total = sum(rep.buttons for rep in reports)
    forms_total = sum(rep.forms for rep in reports)
    return Coverage(
        pages=CoverageMetric(label="Pages", discovered=max(pages, len(links)), tested=pages),
        # Buttons are discovered but not clicked in the deterministic crawl.
        buttons=CoverageMetric(label="Buttons", discovered=buttons_total, tested=0),
        # Every discovered form is examined by the static validation check.
        forms=CoverageMetric(label="Forms", discovered=forms_total, tested=forms_total),
        apis=CoverageMetric(label="API endpoints", discovered=len(api_hits), tested=len(api_hits)),
        workflows=CoverageMetric(label="Workflows", discovered=0, tested=0),
    )
