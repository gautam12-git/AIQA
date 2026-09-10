from fastapi import APIRouter, BackgroundTasks

from app import store
from app.api.errors import api_error
from app.schemas import StartScanRequest, TestRun
from app.services.orchestrator import launch_run

router = APIRouter()

# Modes permitted against production (read-limited, safe actions only).
_PROD_SAFE_MODES = {"quick"}


@router.post("/scans", response_model=TestRun, status_code=201)
async def start_scan(req: StartScanRequest, background: BackgroundTasks):
    if not req.authorized:
        raise api_error(403, "authorization_required",
                        "You must confirm authorization to test this target.")

    if req.environment == "production" and req.mode not in _PROD_SAFE_MODES:
        raise api_error(422, "unsafe_in_production",
                        "Only safe, read-limited modes may run against production. "
                        "Point at staging for full testing.")

    run = store.create_run(req)
    # Persist the new project (may be ad-hoc) + queued run.
    from app import persistence
    project = store.get_project(run.project_id)
    if project:
        await persistence.persist_project(project)
    await persistence.persist_run(run)
    # Credentials are passed in-memory to the orchestrator and NEVER persisted.
    creds = [c.model_dump() for c in (req.credentials or [])] if req.authorized else None
    background.add_task(launch_run, run.id, creds)
    return run
