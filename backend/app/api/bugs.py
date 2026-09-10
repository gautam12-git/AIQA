from fastapi import APIRouter, Query

from app import store
from app.api.errors import not_found
from app.schemas import Bug

router = APIRouter()


@router.get("/bugs", response_model=list[Bug])
async def list_bugs(
    project_id: str | None = Query(default=None, alias="projectId"),
    run_id: str | None = Query(default=None, alias="runId"),
    category: str | None = None,
    severity: str | None = None,
):
    return store.list_bugs(project_id, run_id, category, severity)


@router.get("/bugs/{bug_id}", response_model=Bug)
async def get_bug(bug_id: str):
    bug = store.get_bug(bug_id)
    if not bug:
        raise not_found(f"Bug {bug_id}")
    return bug
