from fastapi import APIRouter

from app import store
from app.schemas import DashboardStats

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard():
    return store.dashboard_stats()
