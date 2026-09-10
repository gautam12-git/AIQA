from fastapi import APIRouter

from app.api.errors import api_error
from app.schemas import RepoReviewRequest, RepoReviewResult
from app.services.repo_review import review_repo

router = APIRouter()


@router.post("/repo-reviews", response_model=RepoReviewResult)
async def review_repository(req: RepoReviewRequest):
    if not req.repo_url.strip():
        raise api_error(422, "empty_url", "A GitHub repository URL is required.")
    try:
        return await review_repo(req)
    except ValueError as e:
        raise api_error(422, "bad_repo_url", str(e))
