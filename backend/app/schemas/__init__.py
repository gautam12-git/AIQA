"""Pydantic schemas — the wire contract. Mirror of `lib/types.ts`.

Every model serializes to **camelCase** (via `to_camel` aliases) so JSON
matches the TypeScript types exactly. Internally we use snake_case.
Serialize responses with `by_alias=True` (done centrally in main.py).
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

# ---- Enums (as Literals to match the TS string unions) ----------------

Severity = Literal["P0", "P1", "P2", "P3"]
Confidence = Literal["confirmed", "high", "medium", "low", "suspected"]
BugCategory = Literal[
    "functional", "ui", "api", "security", "business-logic",
    "workflow", "data-consistency", "performance", "accessibility", "regression",
]
TestMode = Literal["quick", "standard", "deep", "security", "business-logic", "full-autonomous"]
RunStatus = Literal["queued", "running", "completed", "failed", "cancelled"]
Environment = Literal["production", "staging", "local", "qa"]
BugStatus = Literal["open", "verifying", "confirmed", "dismissed", "fixed"]


class Schema(BaseModel):
    """Base: camelCase on the wire, accept either casing on input."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )


# ---- Evidence ---------------------------------------------------------

class NetworkEvidence(Schema):
    method: str
    url: str
    status: int
    duration_ms: int
    request_body: Optional[str] = None
    response_body: Optional[str] = None


class ConsoleEvidence(Schema):
    level: Literal["log", "info", "warn", "error"]
    message: str
    at: str


class ReproStep(Schema):
    n: int
    action: str
    target: Optional[str] = None
    detail: Optional[str] = None


class Evidence(Schema):
    screenshot_label: Optional[str] = None
    screenshot_url: Optional[str] = None  # served path, e.g. /evidence/<run>/page-0.png
    dom_snapshot: Optional[str] = None
    network: Optional[list[NetworkEvidence]] = None
    console: Optional[list[ConsoleEvidence]] = None
    expected: Optional[str] = None
    actual: Optional[str] = None
    relevant_state: Optional[dict[str, str]] = None


# ---- Bug --------------------------------------------------------------

class Bug(Schema):
    id: str
    project_id: str
    run_id: str
    title: str
    severity: Severity
    confidence: Confidence
    category: BugCategory
    affected_url: Optional[str] = None
    affected_api: Optional[str] = None
    environment: Environment
    created_at: str
    description: str
    expected_behavior: str
    actual_behavior: str
    repro_steps: list[ReproStep]
    evidence: Evidence
    impact: str
    suggested_fix: Optional[str] = None
    frequency: Optional[str] = None
    related_bug_ids: Optional[list[str]] = None
    is_regression: Optional[bool] = None
    status: BugStatus


# ---- Coverage ---------------------------------------------------------

class CoverageMetric(Schema):
    label: str
    discovered: int
    tested: int


class Coverage(Schema):
    pages: CoverageMetric
    buttons: CoverageMetric
    forms: CoverageMetric
    apis: CoverageMetric
    workflows: CoverageMetric


# ---- App map ----------------------------------------------------------

class AppMapNode(Schema):
    id: str
    label: str
    path: str
    kind: Literal["page", "auth", "api", "admin", "flow"]
    bug_count: int
    worst_severity: Optional[Severity] = None
    children: Optional[list["AppMapNode"]] = None


# ---- Test run ---------------------------------------------------------

class RunPhase(Schema):
    name: str
    status: Literal["pending", "active", "done"]
    detail: Optional[str] = None


class TestRun(Schema):
    id: str
    project_id: str
    mode: TestMode
    status: RunStatus
    environment: Environment
    started_at: str
    finished_at: Optional[str] = None
    progress: int
    instruction: Optional[str] = None
    bug_counts: dict[str, int]
    coverage: Coverage
    phases: list[RunPhase]
    actions_executed: int
    duration_ms: Optional[int] = None


# ---- Project ----------------------------------------------------------

class Project(Schema):
    id: str
    name: str
    url: str
    environment: Environment
    created_at: str
    last_scan_at: Optional[str] = None
    app_type: str
    roles: list[str]
    open_bugs: int
    critical_bugs: int
    coverage: Coverage
    health_score: int


# ---- Dashboard --------------------------------------------------------

class DashboardStats(Schema):
    projects: int
    active_runs: int
    total_bugs: int
    bugs_by_severity: dict[str, int]
    regressions: int
    api_health: int
    security_findings: int
    a11y_issues: int
    avg_coverage: int
    perf_score: int


# ---- Requests ---------------------------------------------------------

class Credential(Schema):
    label: str
    username: str
    # password is accepted but never stored in plaintext and never returned
    password: Optional[str] = None


class StartScanRequest(Schema):
    url: str
    environment: Environment = "staging"
    mode: TestMode = "standard"
    instruction: Optional[str] = None
    authorized: bool = False
    credentials: Optional[list[Credential]] = None


class CreateProjectRequest(Schema):
    name: str
    url: str
    environment: Environment = "staging"


class ErrorBody(Schema):
    code: str
    message: str
    details: Optional[dict] = None


class ErrorResponse(Schema):
    error: ErrorBody


# ---- Code review -------------------------------------------------------

CodeFindingCategory = Literal[
    "syntax", "logic", "bug", "security", "performance",
    "formatting", "style", "best-practice",
]


class CodeFinding(Schema):
    id: str
    title: str
    severity: Severity
    category: CodeFindingCategory
    line: Optional[int] = None
    description: str
    suggestion: str
    corrected_snippet: Optional[str] = None
    source: Literal["deterministic", "ai"] = "deterministic"


class CodeReviewRequest(Schema):
    code: str
    language: str = "auto"
    filename: Optional[str] = None
    instruction: Optional[str] = None


class CodeReviewResult(Schema):
    language: str
    filename: Optional[str] = None
    summary: str
    findings: list[CodeFinding]
    corrected_code: Optional[str] = None
    llm_used: bool = False
    note: Optional[str] = None


# ---- GitHub repo review ----------------------------------------------

class RepoFileReview(Schema):
    path: str
    language: str
    findings: list[CodeFinding]
    corrected_code: Optional[str] = None


class RepoReviewRequest(Schema):
    repo_url: str
    subpath: Optional[str] = None
    max_files: int = 6
    github_token: Optional[str] = None


class RepoReviewResult(Schema):
    repo: str
    ref: str
    summary: str
    files_reviewed: int
    files_available: int
    files: list[RepoFileReview]
    llm_used: bool = False
    note: Optional[str] = None


# ---- Visual UI review (vision model) ----------------------------------

UICategory = Literal[
    "layout", "overflow", "alignment", "contrast", "spacing",
    "responsive", "content", "readability", "other",
]


class UIFinding(Schema):
    id: str
    title: str
    severity: Severity
    category: UICategory
    location: Optional[str] = None  # where on the page, in words
    description: str
    suggestion: str


class UIReviewRequest(Schema):
    url: str
    environment: Environment = "staging"
    instruction: Optional[str] = None
    viewport: Literal["desktop", "mobile"] = "desktop"


class UIReviewResult(Schema):
    url: str
    viewport: str
    summary: str
    findings: list[UIFinding]
    screenshot: Optional[str] = None  # data: URL of the captured screenshot
    llm_used: bool = False
    note: Optional[str] = None


AppMapNode.model_rebuild()
