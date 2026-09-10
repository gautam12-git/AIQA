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
    llm_ready = bool(s.glm_api_key) or bool(s.modal_key and s.modal_secret)
    return {
        "status": "healthy",
        "version": s.version,
        "llmProvider": s.llm_provider,
        "llmConfigured": llm_ready,
        "database": "mysql",
        "databaseConnected": db_ok,
        "persistenceActive": persistence.active(),
    }
