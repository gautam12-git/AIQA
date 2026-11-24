from fastapi import APIRouter

from app.config import get_settings

router = APIRouter()


@router.get("/health")
async def health():
    s = get_settings()
    # DB check is best-effort: never let it fail the health endpoint.
    try:
        from app.db import ping

        db_ok = await ping()
    except Exception:
        db_ok = False
    from app import persistence
    from app.llm.client import get_llm
    llm_ready = get_llm().configured
    return {
        "status": "healthy",
        "version": s.version,
        "llmProvider": s.llm_provider,
        "llmConfigured": llm_ready,
        "database": "mysql",
        "databaseConnected": db_ok,
        "persistenceActive": persistence.active(),
    }
