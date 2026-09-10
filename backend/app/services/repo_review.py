"""GitHub repo review — review a whole repository's code, not just a snippet.

Fetches a public GitHub repo as a zip (no git dependency), picks the most
relevant source files (bounded, since LLM review is slow/costly), and runs the
existing code-review engine on each. Findings are grouped by file into one
report. Designed so the same per-file review plugs into a PR/CI bot later.
"""

from __future__ import annotations

import asyncio
import io
import re
import zipfile

import httpx

from app.schemas import CodeReviewRequest, RepoFileReview, RepoReviewRequest, RepoReviewResult
from app.services.code_review import analyze, resolve_language

# Directories and files we never review.
_SKIP_DIRS = {"node_modules", ".git", "dist", "build", "vendor", ".next", "__pycache__",
              ".venv", "venv", "out", "coverage", ".turbo", "target", "bin", "obj"}
_CODE_EXT = {"py", "js", "jsx", "ts", "tsx", "java", "go", "rb", "php", "cs",
             "c", "cpp", "cc", "h", "rs", "kt", "swift", "sql", "vue", "svelte"}
_MAX_FILE_BYTES = 45_000
_MAX_FILES_CAP = 20


def parse_repo_url(url: str) -> tuple[str, str, str | None, str | None]:
    """Return (owner, repo, ref, subpath). ref/subpath may be None."""
    u = url.strip().removesuffix(".git").rstrip("/")
    u = re.sub(r"^https?://(www\.)?github\.com/", "", u)
    parts = [p for p in u.split("/") if p]
    if len(parts) < 2:
        raise ValueError("Expected a GitHub repo URL like https://github.com/owner/repo")
    owner, repo = parts[0], parts[1]
    ref = subpath = None
    if len(parts) >= 4 and parts[2] in ("tree", "blob"):
        ref = parts[3]
        subpath = "/".join(parts[4:]) or None
    return owner, repo, ref, subpath


async def _fetch_zip(owner: str, repo: str, ref: str | None, token: str | None) -> tuple[bytes, str]:
    headers = {"User-Agent": "AIQA-CodeReview", "Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    async with httpx.AsyncClient(follow_redirects=True, timeout=60) as http:
        used_ref = ref
        if not used_ref:
            # discover default branch
            r = await http.get(f"https://api.github.com/repos/{owner}/{repo}", headers=headers)
            r.raise_for_status()
            used_ref = r.json().get("default_branch", "main")
        z = await http.get(f"https://api.github.com/repos/{owner}/{repo}/zipball/{used_ref}", headers=headers)
        z.raise_for_status()
        return z.content, used_ref


def _select_files(zip_bytes: bytes, subpath: str | None, max_files: int) -> tuple[list[tuple[str, str]], int]:
    """Return ([(path, content)], total_code_files_available)."""
    picked: list[tuple[str, str]] = []
    candidates: list[tuple[str, str]] = []
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for info in zf.infolist():
            if info.is_dir() or info.file_size > _MAX_FILE_BYTES:
                continue
            # strip the top-level "owner-repo-sha/" folder
            rel = info.filename.split("/", 1)[1] if "/" in info.filename else info.filename
            if not rel:
                continue
            segs = rel.split("/")
            if any(s in _SKIP_DIRS for s in segs):
                continue
            ext = rel.rsplit(".", 1)[-1].lower() if "." in rel else ""
            if ext not in _CODE_EXT:
                continue
            if subpath and not rel.startswith(subpath.strip("/")):
                continue
            try:
                content = zf.read(info.filename).decode("utf-8", errors="replace")
            except Exception:
                continue
            candidates.append((rel, content))

    total = len(candidates)
    # Prioritize: real source dirs first, shallower paths, smaller files.
    def score(item: tuple[str, str]) -> tuple:
        path = item[0]
        in_src = 0 if re.search(r"(^|/)(src|app|lib|backend|api|components|services)/", path) else 1
        is_test = 1 if re.search(r"(test|spec|__tests__)", path.lower()) else 0
        return (is_test, in_src, path.count("/"), len(item[1]))

    for item in sorted(candidates, key=score)[:min(max_files, _MAX_FILES_CAP)]:
        picked.append(item)
    return picked, total


async def review_repo(req: RepoReviewRequest) -> RepoReviewResult:
    owner, repo, ref, url_subpath = parse_repo_url(req.repo_url)
    subpath = req.subpath or url_subpath
    try:
        zip_bytes, used_ref = await _fetch_zip(owner, repo, ref, req.github_token)
    except Exception as exc:
        return RepoReviewResult(repo=f"{owner}/{repo}", ref=ref or "?", summary="Could not fetch the repository.",
                                files_reviewed=0, files_available=0, files=[], llm_used=False,
                                note=f"fetch error: {str(exc)[:160]}")

    selected, total = _select_files(zip_bytes, subpath, max(1, min(req.max_files, _MAX_FILES_CAP)))
    if not selected:
        return RepoReviewResult(repo=f"{owner}/{repo}", ref=used_ref, summary="No reviewable source files found.",
                                files_reviewed=0, files_available=total, files=[], llm_used=False,
                                note="No code files matched (check the subpath or extensions).")

    # Review files with limited concurrency (gentle on the shared LLM tier).
    sem = asyncio.Semaphore(2)

    async def one(path: str, content: str) -> RepoFileReview:
        async with sem:
            res = await analyze(CodeReviewRequest(code=content, language="auto", filename=path))
        return RepoFileReview(path=path, language=res.language, findings=res.findings,
                              corrected_code=res.corrected_code)

    files = await asyncio.gather(*(one(p, c) for p, c in selected))
    total_findings = sum(len(f.findings) for f in files)
    any_llm = any(f.corrected_code for f in files) or total_findings > 0
    summary = (f"Reviewed {len(files)} of {total} source file(s) in {owner}/{repo} — "
               f"{total_findings} finding(s).")
    return RepoReviewResult(repo=f"{owner}/{repo}", ref=used_ref, summary=summary,
                            files_reviewed=len(files), files_available=total, files=list(files),
                            llm_used=any_llm)
