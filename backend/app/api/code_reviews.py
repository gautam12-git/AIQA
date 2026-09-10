from fastapi import APIRouter

from app.api.errors import api_error
from app.schemas import CodeReviewRequest, CodeReviewResult
from app.services.code_review import analyze

router = APIRouter()


@router.post("/code-reviews", response_model=CodeReviewResult)
async def review_code(req: CodeReviewRequest):
    if not req.code.strip():
        raise api_error(422, "empty_code", "No code was provided to review.")
    if len(req.code) > 60000:
        raise api_error(422, "too_large", "Code exceeds the 60k-character limit for a single review.")
    return await analyze(req)
