"""In-memory data store — the scaffold's stand-in for a database.

Returns contract-shaped objects so the API is executable today and the
frontend can run against it end-to-end. Swap this module for a real
repository (Postgres) without touching the routers. Mirrors the seed in
`aiqa/lib/mock-data.ts`.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.schemas import (
    AppMapNode, Bug, Coverage, CoverageMetric, DashboardStats, Evidence,
    NetworkEvidence, Project, ReproStep, RunPhase, StartScanRequest, TestRun,
)


def _cov(p, b, f, a, w) -> Coverage:
    return Coverage(
        pages=CoverageMetric(label="Pages", discovered=p[0], tested=p[1]),
        buttons=CoverageMetric(label="Buttons", discovered=b[0], tested=b[1]),
        forms=CoverageMetric(label="Forms", discovered=f[0], tested=f[1]),
        apis=CoverageMetric(label="API endpoints", discovered=a[0], tested=a[1]),
        workflows=CoverageMetric(label="Workflows", discovered=w[0], tested=w[1]),
    )


PROJECTS: list[Project] = [
    Project(
        id="prj_shopwave", name="ShopWave Commerce", url="https://staging.shopwave.io",
        environment="staging", created_at="2026-07-14T09:00:00Z", last_scan_at="2026-09-05T06:12:00Z",
        app_type="E-commerce (SPA)", roles=["Guest", "Customer", "Merchant", "Admin"],
        open_bugs=14, critical_bugs=2,
        coverage=_cov((84, 78), (421, 356), (32, 30), (117, 104), (28, 21)), health_score=72,
    ),
    Project(
        id="prj_flowdesk", name="FlowDesk CRM", url="https://qa.flowdesk.app",
        environment="qa", created_at="2026-08-02T11:30:00Z", last_scan_at="2026-09-04T22:40:00Z",
        app_type="SaaS / CRM", roles=["User", "Manager", "Admin", "Super Admin"],
        open_bugs=9, critical_bugs=1,
        coverage=_cov((56, 51), (288, 240), (24, 22), (93, 80), (19, 15)), health_score=81,
    ),
]

RUNS: list[TestRun] = [
    TestRun(
        id="run_9f2a", project_id="prj_shopwave", mode="full-autonomous", status="running",
        environment="staging", started_at="2026-09-05T06:12:00Z", progress=63,
        instruction="Find anything wrong with the checkout and cart flows.",
        bug_counts={"P0": 1, "P1": 3, "P2": 5, "P3": 4},
        coverage=_cov((84, 52), (421, 210), (32, 19), (117, 71), (28, 14)), actions_executed=1284,
        phases=[
            RunPhase(name="Discover application", status="done", detail="84 pages mapped"),
            RunPhase(name="Identify roles & entities", status="done", detail="4 roles, 9 entities"),
            RunPhase(name="Generate test hypotheses", status="done", detail="212 hypotheses"),
            RunPhase(name="Execute & verify", status="active", detail="checkout workflow"),
            RunPhase(name="Regression pass", status="pending"),
            RunPhase(name="Generate report", status="pending"),
        ],
    ),
    TestRun(
        id="run_7b41", project_id="prj_flowdesk", mode="security", status="completed",
        environment="qa", started_at="2026-09-04T21:50:00Z", finished_at="2026-09-04T22:40:00Z",
        progress=100, duration_ms=50 * 60 * 1000,
        instruction="Authorization audit across all roles (OWASP API Top 10).",
        bug_counts={"P0": 1, "P1": 2, "P2": 3, "P3": 1},
        coverage=_cov((56, 51), (288, 240), (24, 22), (93, 80), (19, 15)), actions_executed=2041,
        phases=[
            RunPhase(name="Discover application", status="done"),
            RunPhase(name="Build authorization matrix", status="done", detail="4 roles × 47 actions"),
            RunPhase(name="Execute & verify", status="done"),
            RunPhase(name="Generate report", status="done"),
        ],
    ),
]

BUGS: list[Bug] = [
    Bug(
        id="BUG-1051", project_id="prj_flowdesk", run_id="run_7b41",
        title="User A can read User B's contact records via IDOR on /api/contacts/:id",
        severity="P0", confidence="confirmed", category="security",
        affected_api="GET /api/contacts/{id}", affected_url="https://qa.flowdesk.app",
        environment="qa", created_at="2026-09-04T22:05:00Z",
        description=(
            "Broken object-level authorization (OWASP API1:2023). As User A, requesting a "
            "contact ID owned by User B returns the full record, including email and phone."
        ),
        expected_behavior="403 Forbidden — the contact does not belong to the requesting user's org.",
        actual_behavior="200 OK with User B's full contact payload.",
        repro_steps=[
            ReproStep(n=1, action="Login", target="User A (userA@test.dev)"),
            ReproStep(n=2, action="Capture session token"),
            ReproStep(n=3, action="GET", target="/api/contacts/8814", detail="record owned by User B's org"),
            ReproStep(n=4, action="Observe response", detail="200 OK, full PII returned"),
        ],
        evidence=Evidence(
            screenshot_label="idor-contacts.png", expected="403 Forbidden", actual="200 OK",
            network=[NetworkEvidence(
                method="GET", url="/api/contacts/8814", status=200, duration_ms=132,
                response_body='{"id":8814,"orgId":"org_B","name":"J. Rivera","email":"j.rivera@acme.co"}',
            )],
        ),
        impact="Cross-tenant PII exposure. A single authenticated user can enumerate other orgs' contacts.",
        suggested_fix="Enforce org-scoped authorization in the data layer, filtering by session orgId.",
        frequency="5/5 reproductions", status="confirmed",
    ),
    Bug(
        id="BUG-1042", project_id="prj_shopwave", run_id="run_9f2a",
        title="Checkout total does not apply 20% coupon — charges full price",
        severity="P1", confidence="confirmed", category="business-logic",
        affected_url="https://staging.shopwave.io/checkout", affected_api="POST /api/v2/checkout/quote",
        environment="staging", created_at="2026-09-05T06:31:00Z",
        description="Coupon SAVE20 shows a discount in the cart, but the checkout quote returns full price.",
        expected_behavior="Order total = $80.00 (20% off $100.00).",
        actual_behavior="Order total = $100.00; discount line shows -$20.00 but is not subtracted.",
        repro_steps=[
            ReproStep(n=1, action="Add to cart", target="wireless earbuds"),
            ReproStep(n=2, action="Apply coupon", target="SAVE20", detail="cart shows -$20.00"),
            ReproStep(n=3, action="Proceed to checkout"),
            ReproStep(n=4, action="Observe total", detail="renders $100.00, not $80.00"),
        ],
        evidence=Evidence(
            expected="80.00", actual="100.00",
            relevant_state={"subtotal": "100.00", "coupon": "SAVE20", "discount": "20.00"},
            network=[NetworkEvidence(
                method="POST", url="/api/v2/checkout/quote", status=200, duration_ms=412,
                request_body='{"items":[{"sku":"WEB-01","qty":1}],"coupon":"SAVE20"}',
                response_body='{"subtotal":100.00,"discount":20.00,"total":100.00}',
            )],
        ),
        impact="Revenue-integrity defect; customers overcharged.",
        suggested_fix="Subtract discount from subtotal in the quote resolver; add total invariant test.",
        frequency="3/3 reproductions", is_regression=True, status="confirmed",
    ),
]

APP_MAPS: dict[str, AppMapNode] = {
    "prj_shopwave": AppMapNode(
        id="root", label="ShopWave", path="/", kind="page", bug_count=0,
        children=[
            AppMapNode(id="home", label="Homepage", path="/", kind="page", bug_count=0),
            AppMapNode(id="cart", label="Cart", path="/cart", kind="flow", bug_count=1, worst_severity="P1",
                       children=[AppMapNode(id="checkout", label="Checkout", path="/checkout", kind="flow",
                                            bug_count=3, worst_severity="P0")]),
            AppMapNode(id="api", label="API", path="/api", kind="api", bug_count=2, worst_severity="P0"),
        ],
    ),
    "prj_flowdesk": AppMapNode(
        id="root", label="FlowDesk", path="/", kind="page", bug_count=0,
        children=[
            AppMapNode(id="contacts", label="Contacts", path="/app/contacts", kind="page",
                       bug_count=1, worst_severity="P0"),
            AppMapNode(id="api", label="API", path="/api", kind="api", bug_count=2, worst_severity="P0"),
        ],
    ),
}

_SEV_ORDER = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}

# Per-run crawled pages: run_id -> list of {"url", "screenshot"} (in-memory only).
RUN_PAGES: dict[str, list[dict]] = {}


def set_run_pages(run_id: str, pages: list[dict]) -> None:
    RUN_PAGES[run_id] = pages


def get_run_pages(run_id: str) -> list[dict]:
    return RUN_PAGES.get(run_id, [])


def remove_vision_bugs(run_id: str) -> None:
    """Drop prior vision-UI findings for a run so re-analysis replaces them."""
    prefix = f"AIQAV-{run_id.replace('run_', '')}"
    BUGS[:] = [b for b in BUGS if not b.id.startswith(prefix)]


# ---- Read helpers -----------------------------------------------------

def list_projects() -> list[Project]:
    return PROJECTS


def get_project(pid: str) -> Project | None:
    return next((p for p in PROJECTS if p.id == pid), None)


def get_app_map(pid: str) -> AppMapNode | None:
    return APP_MAPS.get(pid)


def list_runs(project_id: str | None = None) -> list[TestRun]:
    rs = [r for r in RUNS if not project_id or r.project_id == project_id]
    return sorted(rs, key=lambda r: r.started_at, reverse=True)


def get_run(rid: str) -> TestRun | None:
    return next((r for r in RUNS if r.id == rid), None)


def list_bugs(project_id=None, run_id=None, category=None, severity=None) -> list[Bug]:
    bs = BUGS
    if project_id:
        bs = [b for b in bs if b.project_id == project_id]
    if run_id:
        bs = [b for b in bs if b.run_id == run_id]
    if category:
        bs = [b for b in bs if b.category == category]
    if severity:
        bs = [b for b in bs if b.severity == severity]
    return sorted(bs, key=lambda b: (_SEV_ORDER[b.severity], b.created_at), reverse=False)


def get_bug(bid: str) -> Bug | None:
    return next((b for b in BUGS if b.id == bid), None)


def _coverage_pct(c: Coverage) -> int:
    """Percent of discovered surface actually tested (mirrors lib/format.ts)."""
    d = (c.pages.discovered + c.buttons.discovered + c.forms.discovered
         + c.apis.discovered + c.workflows.discovered)
    t = (c.pages.tested + c.buttons.tested + c.forms.tested
         + c.apis.tested + c.workflows.tested)
    return 0 if d == 0 else round(t / d * 100)


def dashboard_stats() -> DashboardStats:
    open_bugs = [b for b in BUGS if b.status not in ("dismissed", "fixed")]
    by_sev = {"P0": 0, "P1": 0, "P2": 0, "P3": 0}
    for b in open_bugs:
        by_sev[b.severity] += 1

    # All three scores are DERIVED from real data — no hardcoded values.
    avg_coverage = (
        round(sum(_coverage_pct(p.coverage) for p in PROJECTS) / len(PROJECTS))
        if PROJECTS else 0
    )
    perf_open = len([b for b in open_bugs if b.category == "performance"])
    api_sec_open = len([b for b in open_bugs if b.category in ("api", "security")])
    perf_score = max(0, 100 - min(100, perf_open * 15))
    api_health = max(0, 100 - min(100, api_sec_open * 12))

    return DashboardStats(
        projects=len(PROJECTS),
        active_runs=len([r for r in RUNS if r.status in ("running", "queued")]),
        total_bugs=len(open_bugs),
        bugs_by_severity=by_sev,
        regressions=len([b for b in open_bugs if b.is_regression]),
        api_health=api_health,
        security_findings=len([b for b in open_bugs if b.category == "security"]),
        a11y_issues=len([b for b in open_bugs if b.category == "accessibility"]),
        avg_coverage=avg_coverage, perf_score=perf_score,
    )


# ---- Write helpers ----------------------------------------------------

def ensure_project(url: str, environment: str) -> Project:
    """Return the project for a URL, creating an ad-hoc one if unknown."""
    existing = next((p for p in PROJECTS if p.url.rstrip("/") == url.rstrip("/")), None)
    if existing:
        return existing
    from urllib.parse import urlparse
    host = urlparse(url).netloc or url
    project = Project(
        id=f"prj_{uuid.uuid4().hex[:6]}", name=host, url=url, environment=environment,
        created_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        app_type="Discovered site", roles=["Guest"], open_bugs=0, critical_bugs=0,
        coverage=_cov((0, 0), (0, 0), (0, 0), (0, 0), (0, 0)), health_score=100,
    )
    PROJECTS.append(project)
    return project


def add_bugs(new_bugs: list[Bug]) -> None:
    BUGS.extend(new_bugs)


def recount_project(project_id: str) -> None:
    project = get_project(project_id)
    if not project:
        return
    pbugs = [b for b in BUGS if b.project_id == project_id and b.status not in ("dismissed", "fixed")]
    project.open_bugs = len(pbugs)
    project.critical_bugs = len([b for b in pbugs if b.severity == "P0"])


def create_run(req: StartScanRequest) -> TestRun:
    """Create a queued run. The orchestrator picks it up from here."""
    project = ensure_project(req.url, req.environment)
    run = TestRun(
        id=f"run_{uuid.uuid4().hex[:4]}",
        project_id=project.id,
        mode=req.mode, status="queued", environment=req.environment,
        started_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        progress=0, instruction=req.instruction,
        bug_counts={"P0": 0, "P1": 0, "P2": 0, "P3": 0},
        coverage=_cov((0, 0), (0, 0), (0, 0), (0, 0), (0, 0)),
        phases=[
            RunPhase(name="Discover application", status="pending"),
            RunPhase(name="Execute & verify", status="pending"),
            RunPhase(name="Generate report", status="pending"),
        ],
        actions_executed=0,
    )
    RUNS.append(run)
    return run
