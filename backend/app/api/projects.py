from fastapi import APIRouter

from app import store
from app.api.errors import not_found
from app.schemas import AppMapNode, Project

router = APIRouter()


@router.get("/projects", response_model=list[Project])
async def list_projects():
    return store.list_projects()


@router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    project = store.get_project(project_id)
    if not project:
        raise not_found(f"Project {project_id}")
    return project


@router.get("/projects/{project_id}/app-map", response_model=AppMapNode)
async def get_app_map(project_id: str):
    app_map = store.get_app_map(project_id)
    if not app_map:
        raise not_found(f"App map for {project_id}")
    return app_map
