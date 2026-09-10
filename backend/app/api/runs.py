import asyncio
import json
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app import store
from app.api.errors import not_found
from app.schemas import Bug, Evidence, ReproStep, TestRun
from app.services.vision_review import analyze_image_bytes

_EVIDENCE_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "evidence")

router = APIRouter()


@router.get("/runs", response_model=list[TestRun])
async def list_runs(project_id: str | None = Query(default=None, alias="projectId")):
    return store.list_runs(project_id)


@router.get("/runs/{run_id}", response_model=TestRun)
async def get_run(run_id: str):
    run = store.get_run(run_id)
    if not run:
        raise not_found(f"Run {run_id}")
    return run


@router.post("/runs/{run_id}/cancel", response_model=TestRun)
async def cancel_run(run_id: str):
    run = store.get_run(run_id)
    if not run:
        raise not_found(f"Run {run_id}")
    if run.status in ("running", "queued"):
        run.status = "cancelled"
    return run


_TERMINAL = {"completed", "failed", "cancelled"}


@router.post("/runs/{run_id}/ui-review")
async def run_ui_review(run_id: str, max_pages: int = Query(default=3, ge=1, le=10)):
    """On-demand visual UI analysis — vision-checks the run's captured
    screenshots and merges any UI findings into this run's report."""
    run = store.get_run(run_id)
    if not run:
        raise not_found(f"Run {run_id}")

    pages = store.get_run_pages(run_id)[:max_pages]
    short = run_id.replace("run_", "")
    store.remove_vision_bugs(run_id)  # replace prior visual findings

    new_bugs: list[Bug] = []
    analyzed = 0
    for pi, page in enumerate(pages):
        path = os.path.join(_EVIDENCE_ROOT, run_id, page["screenshot"])
        if not os.path.exists(path):
            continue
        with open(path, "rb") as fh:
            image = fh.read()
        findings, _summary, _note = await analyze_image_bytes(
            image, page["url"], id_prefix=f"AIQAV-{short}-{pi}")
        analyzed += 1
        shot_url = f"/evidence/{run_id}/{page['screenshot']}"
        for f in findings:
            new_bugs.append(Bug(
                id=f.id, project_id=run.project_id, run_id=run_id, environment=run.environment,
                created_at=datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
                title=f.title, severity=f.severity, confidence="high", category="ui",
                affected_url=page["url"],
                description=f.description + (f" (Location: {f.location})" if f.location else ""),
                expected_behavior="No visual defects on the page.",
                actual_behavior=f.description,
                repro_steps=[ReproStep(n=1, action="Open", target=page["url"]),
                             ReproStep(n=2, action="Observe", detail=f.location or "the affected area")],
                evidence=Evidence(screenshot_label=page["screenshot"], screenshot_url=shot_url),
                impact="Visual defect degrades the user experience.",
                suggested_fix=f.suggestion, status="open",
            ))

    if new_bugs:
        store.add_bugs(new_bugs)
    store.recount_project(run.project_id)
    # refresh the run's bug tally to include visual findings
    all_run_bugs = store.list_bugs(run_id=run_id)
    counts = {"P0": 0, "P1": 0, "P2": 0, "P3": 0}
    for b in all_run_bugs:
        counts[b.severity] += 1
    run.bug_counts = counts

    from app import persistence
    await persistence.persist_bugs(new_bugs)
    await persistence.persist_run(run)

    return {"added": len(new_bugs), "pagesAnalyzed": analyzed}


@router.get("/runs/{run_id}/events")
async def run_events(run_id: str):
    """Live SSE stream of run state (CONTRACT.md → 'Live run stream').

    Emits a `snapshot` event (the full run, camelCase) whenever the run's
    progress/status/phases change, and a final `done` event at terminal
    status. The client updates from each snapshot and stops on `done`.
    """
    if not store.get_run(run_id):
        raise not_found(f"Run {run_id}")

    async def gen():
        last_sig = None
        # Stream until the run reaches a terminal state; hard-cap ~30 min so a
        # stuck run never streams forever.
        for _ in range(3600):
            run = store.get_run(run_id)
            if run is None:
                break
            sig = (run.status, run.progress, tuple((p.name, p.status) for p in run.phases))
            if sig != last_sig:
                last_sig = sig
                yield _sse("snapshot", run.model_dump(by_alias=True))
            if run.status in _TERMINAL:
                yield _sse("done", {"status": run.status})
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
