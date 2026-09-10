"""Deterministic detectors — turn page telemetry into evidence-backed bugs.

No LLM here: these are cheap, high-signal, low-false-positive checks that
should always run (vision §3 hybrid model). Each finding carries real
evidence — the captured response, console output, and a screenshot.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.schemas import (
    Bug, ConsoleEvidence, Evidence, NetworkEvidence, ReproStep,
)
from app.services.browser import PageReport


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _console_ev(report: PageReport) -> list[ConsoleEvidence]:
    lvl = {"warning": "warn", "error": "error", "info": "info", "debug": "log", "log": "log"}
    return [
        ConsoleEvidence(level=lvl.get(m.level, "log"), message=m.text[:300], at=report.url)
        for m in report.console
    ][:15]


def _shot(report: PageReport) -> str | None:
    return report.screenshot_path.split("/")[-1].split("\\")[-1] if report.screenshot_path else None


def _shot_url(run_id: str, report: PageReport) -> str | None:
    name = _shot(report)
    return f"/evidence/{run_id}/{name}" if name else None


class _Seq:
    def __init__(self, run_id: str):
        self.prefix = f"AIQA-{run_id.replace('run_', '')}"
        self.n = 0

    def next(self) -> str:
        self.n += 1
        return f"{self.prefix}-{self.n:03d}"


def run_detectors(reports: list[PageReport], run_id: str, project_id: str, environment: str) -> list[Bug]:
    seq = _Seq(run_id)
    bugs: list[Bug] = []

    def mk(**kw) -> Bug:
        return Bug(id=seq.next(), project_id=project_id, run_id=run_id,
                   environment=environment, created_at=_now(), **kw)

    for r in reports:
        repro = [ReproStep(n=1, action="Open", target=r.url)]

        # 1) Page-level HTTP errors
        if r.status >= 500:
            bugs.append(mk(
                title=f"Server error {r.status} on {_path(r.url)}",
                severity="P1", confidence="high", category="functional",
                affected_url=r.url, status="open",
                description=f"Navigating to the page returned HTTP {r.status}.",
                expected_behavior="Page loads with a 2xx status.",
                actual_behavior=f"HTTP {r.status} returned.",
                repro_steps=repro + [ReproStep(n=2, action="Observe", detail=f"HTTP {r.status}")],
                evidence=Evidence(screenshot_label=_shot(r), screenshot_url=_shot_url(run_id, r), expected="2xx", actual=str(r.status),
                                  network=[NetworkEvidence(method="GET", url=r.url, status=r.status, duration_ms=r.load_ms)]),
                impact="A server error makes this page unusable for every visitor.",
                suggested_fix="Check server logs for the 5xx root cause on this route.",
                frequency="1/1 (pre-verify)",
            ))
        elif r.status >= 400:
            bugs.append(mk(
                title=f"Broken page {r.status} on {_path(r.url)}",
                severity="P2", confidence="high", category="functional",
                affected_url=r.url, status="open",
                description=f"The page returned HTTP {r.status}.",
                expected_behavior="Page loads with a 2xx status.",
                actual_behavior=f"HTTP {r.status} returned.",
                repro_steps=repro + [ReproStep(n=2, action="Observe", detail=f"HTTP {r.status}")],
                evidence=Evidence(screenshot_label=_shot(r), screenshot_url=_shot_url(run_id, r), expected="2xx", actual=str(r.status),
                                  network=[NetworkEvidence(method="GET", url=r.url, status=r.status, duration_ms=r.load_ms)]),
                impact="A broken route degrades navigation and may break links from elsewhere.",
                suggested_fix="Verify the route exists and is reachable; fix or redirect it.",
                frequency="1/1 (pre-verify)",
            ))

        # 2) Uncaught JS exceptions
        if r.page_errors:
            bugs.append(mk(
                title=f"Uncaught JavaScript error on {_path(r.url)}",
                severity="P2", confidence="high", category="ui",
                affected_url=r.url, status="open",
                description="The page threw an uncaught exception during load.",
                expected_behavior="No uncaught exceptions.",
                actual_behavior=r.page_errors[0][:200],
                repro_steps=repro + [ReproStep(n=2, action="Observe console", detail="uncaught error")],
                evidence=Evidence(
                    screenshot_label=_shot(r), screenshot_url=_shot_url(run_id, r),
                    console=[ConsoleEvidence(level="error", message=e[:300], at=r.url) for e in r.page_errors[:5]],
                ),
                impact="Uncaught errors can leave the UI in a broken or partial state.",
                suggested_fix="Reproduce in devtools and guard the failing code path.",
                frequency="1/1 (pre-verify)",
            ))

        # 3) Console errors (non-fatal)
        errs = [m for m in r.console if m.level == "error"]
        if errs and not r.page_errors:
            bugs.append(mk(
                title=f"{len(errs)} console error(s) on {_path(r.url)}",
                severity="P3", confidence="medium", category="functional",
                affected_url=r.url, status="open",
                description="The page logged errors to the console.",
                expected_behavior="Clean console with no errors.",
                actual_behavior=f"{len(errs)} console error(s).",
                repro_steps=repro + [ReproStep(n=2, action="Open devtools console")],
                evidence=Evidence(screenshot_label=_shot(r), screenshot_url=_shot_url(run_id, r), console=_console_ev(r)),
                impact="Console errors often signal latent functional problems.",
                suggested_fix="Triage each error; they frequently mask real failures.",
                frequency="1/1 (pre-verify)",
            ))

        # 4) Broken sub-resources (images/scripts/styles)
        broken = [x for x in r.resources if x.status >= 400]
        imgs = [x for x in broken if x.resource_type == "image"]
        assets = [x for x in broken if x.resource_type in ("script", "stylesheet")]
        if imgs:
            bugs.append(mk(
                title=f"{len(imgs)} broken image(s) on {_path(r.url)}",
                severity="P3", confidence="high", category="ui",
                affected_url=r.url, status="open",
                description="One or more images failed to load.",
                expected_behavior="All images load (2xx).",
                actual_behavior=f"{len(imgs)} image request(s) failed.",
                repro_steps=repro,
                evidence=Evidence(screenshot_label=_shot(r), screenshot_url=_shot_url(run_id, r),
                                  network=[NetworkEvidence(method="GET", url=x.url, status=x.status, duration_ms=0) for x in imgs[:8]]),
                impact="Broken images degrade the page and hurt perceived quality.",
                suggested_fix="Reconcile the missing asset paths.",
                frequency="1/1 (pre-verify)",
            ))
        if assets:
            bugs.append(mk(
                title=f"{len(assets)} failed script/style request(s) on {_path(r.url)}",
                severity="P2", confidence="high", category="functional",
                affected_url=r.url, status="open",
                description="A script or stylesheet failed to load, which can break behavior or layout.",
                expected_behavior="All scripts and styles load (2xx).",
                actual_behavior=f"{len(assets)} asset request(s) failed.",
                repro_steps=repro,
                evidence=Evidence(screenshot_label=_shot(r), screenshot_url=_shot_url(run_id, r),
                                  network=[NetworkEvidence(method="GET", url=x.url, status=x.status, duration_ms=0) for x in assets[:8]]),
                impact="Missing JS/CSS can silently break functionality or layout.",
                suggested_fix="Fix the asset URLs / build output for this page.",
                frequency="1/1 (pre-verify)",
            ))

        # 5) Missing security headers (only meaningful on the main document)
        if 200 <= r.status < 400:
            missing = _missing_headers(r.security_headers)
            if missing:
                bugs.append(mk(
                    title=f"Missing security headers on {_path(r.url)}",
                    severity="P3", confidence="confirmed", category="security",
                    affected_url=r.url, status="confirmed",
                    description="The response is missing recommended security headers: " + ", ".join(missing) + ".",
                    expected_behavior="Response sets the standard security headers.",
                    actual_behavior="Missing: " + ", ".join(missing),
                    repro_steps=repro + [ReproStep(n=2, action="Inspect response headers")],
                    evidence=Evidence(screenshot_label=_shot(r), screenshot_url=_shot_url(run_id, r),
                                      relevant_state={k: (v or "(absent)") for k, v in r.security_headers.items() if not k.startswith("_")}),
                    impact="Missing headers weaken defenses against clickjacking, MIME-sniffing, and downgrade attacks.",
                    suggested_fix="Add the missing headers at the server/CDN edge.",
                    frequency="deterministic",
                ))

        # 6) Performance — real web vitals (LCP / TTFB), falling back to load time.
        if r.status and r.status < 400:
            lcp = r.lcp_ms
            if lcp >= 4000:
                bugs.append(mk(
                    title=f"Poor Largest Contentful Paint ({lcp}ms) on {_path(r.url)}",
                    severity="P2", confidence="medium", category="performance",
                    affected_url=r.url, status="open",
                    description=f"LCP was {lcp}ms — the largest content element takes too long to render.",
                    expected_behavior="LCP under 2500ms (Core Web Vitals 'good').",
                    actual_behavior=f"LCP {lcp}ms.", repro_steps=repro,
                    evidence=Evidence(screenshot_label=_shot(r), screenshot_url=_shot_url(run_id, r), expected="<2500ms", actual=f"{lcp}ms"),
                    impact="Slow perceived load hurts engagement and Core Web Vitals ranking.",
                    suggested_fix="Optimize the largest above-the-fold element (image, CSS, render-blocking JS).",
                    frequency="single sample",
                ))
            elif lcp == 0 and r.load_ms >= 3000:
                bugs.append(mk(
                    title=f"Slow load ({r.load_ms}ms) on {_path(r.url)}",
                    severity="P2", confidence="medium", category="performance",
                    affected_url=r.url, status="open",
                    description=f"The page took {r.load_ms}ms to reach DOMContentLoaded (LCP unavailable).",
                    expected_behavior="Page becomes interactive under ~2.5s.",
                    actual_behavior=f"{r.load_ms}ms to DOMContentLoaded.", repro_steps=repro,
                    evidence=Evidence(screenshot_label=_shot(r), screenshot_url=_shot_url(run_id, r), expected="<2500ms", actual=f"{r.load_ms}ms"),
                    impact="Slow loads reduce engagement and conversion.",
                    suggested_fix="Profile the waterfall; identify the slow resource or endpoint.",
                    frequency="single sample",
                ))
            if r.ttfb_ms >= 800:
                bugs.append(mk(
                    title=f"High TTFB ({r.ttfb_ms}ms) on {_path(r.url)}",
                    severity="P3", confidence="medium", category="performance",
                    affected_url=r.url, status="open",
                    description=f"Time to first byte was {r.ttfb_ms}ms — the server is slow to respond.",
                    expected_behavior="TTFB under 800ms.", actual_behavior=f"TTFB {r.ttfb_ms}ms.",
                    repro_steps=repro,
                    evidence=Evidence(screenshot_label=_shot(r), screenshot_url=_shot_url(run_id, r), expected="<800ms", actual=f"{r.ttfb_ms}ms"),
                    impact="A slow server response delays everything downstream.",
                    suggested_fix="Investigate backend/database latency or CDN caching for this route.",
                    frequency="single sample",
                ))

        # 7) Accessibility (WCAG) — real DOM findings captured during the crawl.
        if r.a11y and 200 <= r.status < 400:
            order = {"serious": 0, "moderate": 1, "minor": 2}
            worst = min((i.get("impact", "minor") for i in r.a11y), key=lambda x: order.get(x, 2))
            sev = "P2" if worst == "serious" else "P3"
            total = sum(int(i.get("count", 0)) for i in r.a11y)
            detail = "; ".join(f'{i.get("count")}× {i.get("desc")}' for i in r.a11y)
            bugs.append(mk(
                title=f"{total} accessibility issue(s) on {_path(r.url)}",
                severity=sev, confidence="high", category="accessibility",
                affected_url=r.url, status="open",
                description="WCAG issues found in the DOM: " + detail + ".",
                expected_behavior="Page meets WCAG 2.2 AA basics: labels, alt text, accessible names, document lang.",
                actual_behavior=detail,
                repro_steps=repro + [ReproStep(n=2, action="Inspect the DOM / run a screen reader")],
                evidence=Evidence(
                    screenshot_label=_shot(r), screenshot_url=_shot_url(run_id, r),
                    relevant_state={i.get("rule", "?"): f'{i.get("count")} ({i.get("impact")})' for i in r.a11y}),
                impact="Blocks users relying on assistive technology; also a legal/compliance risk.",
                suggested_fix="Add alt text, associate <label>s, give controls accessible names, set <html lang>.",
                frequency="deterministic",
            ))

        # 8) API/security header checks — CORS and version disclosure.
        info = r.info_headers or {}
        acao = info.get("access-control-allow-origin", "")
        acac = (info.get("access-control-allow-credentials", "") or "").lower()
        if acao == "*" and acac == "true":
            bugs.append(mk(
                title=f"Insecure CORS: wildcard origin with credentials on {_path(r.url)}",
                severity="P1", confidence="high", category="security",
                affected_url=r.url, status="open",
                description="The response sets Access-Control-Allow-Origin: * together with "
                            "Access-Control-Allow-Credentials: true — a forbidden, exploitable combination.",
                expected_behavior="Reflect a specific allow-listed origin when credentials are allowed; never '*'.",
                actual_behavior="ACAO: * with ACAC: true.",
                repro_steps=repro + [ReproStep(n=2, action="Inspect CORS response headers")],
                evidence=Evidence(screenshot_label=_shot(r), screenshot_url=_shot_url(run_id, r),
                                  relevant_state={"access-control-allow-origin": acao, "access-control-allow-credentials": acac}),
                impact="Any origin can make credentialed cross-site requests and read the response — cross-site data theft.",
                suggested_fix="Echo a validated origin from an allow-list; never combine '*' with credentials.",
                frequency="deterministic",
            ))
        disclosed = {k: v for k, v in info.items() if k in ("server", "x-powered-by", "x-aspnet-version") and v}
        if disclosed and 200 <= r.status < 400:
            shown = ", ".join(f"{k}: {v}" for k, v in disclosed.items())
            bugs.append(mk(
                title=f"Server/framework version disclosure on {_path(r.url)}",
                severity="P3", confidence="confirmed", category="security",
                affected_url=r.url, status="confirmed",
                description="Response headers reveal server/framework details: " + shown + ".",
                expected_behavior="Suppress version-revealing headers.",
                actual_behavior=shown,
                repro_steps=repro + [ReproStep(n=2, action="Inspect response headers")],
                evidence=Evidence(screenshot_label=_shot(r), screenshot_url=_shot_url(run_id, r), relevant_state=disclosed),
                impact="Version banners help attackers target known CVEs for that stack.",
                suggested_fix="Remove or generalize Server / X-Powered-By headers at the edge.",
                frequency="deterministic",
            ))

        # 9) Form validation gaps (static) — required fields without constraints.
        if r.weak_forms and 200 <= r.status < 400:
            bugs.append(mk(
                title=f"{r.weak_forms} form(s) with unvalidated required fields on {_path(r.url)}",
                severity="P3", confidence="medium", category="functional",
                affected_url=r.url, status="open",
                description="One or more forms have required fields with no client-side validation constraint "
                            "(pattern/min/max/length or a semantic input type).",
                expected_behavior="Required fields declare validation constraints so bad input is caught early.",
                actual_behavior=f"{r.weak_forms} form(s) accept unconstrained required input.",
                repro_steps=repro + [ReproStep(n=2, action="Submit the form with empty/invalid values")],
                evidence=Evidence(screenshot_label=_shot(r), screenshot_url=_shot_url(run_id, r)),
                impact="Weak validation lets malformed data reach the backend and worsens UX.",
                suggested_fix="Add appropriate input types and validation attributes; validate server-side too.",
                frequency="deterministic",
            ))

    return bugs


def _path(url: str) -> str:
    from urllib.parse import urlparse
    p = urlparse(url).path or "/"
    return p if len(p) <= 40 else p[:37] + "…"


def _missing_headers(h: dict[str, str]) -> list[str]:
    missing = []
    if not h.get("x-content-type-options"):
        missing.append("X-Content-Type-Options")
    if not h.get("content-security-policy"):
        missing.append("Content-Security-Policy")
    if not h.get("x-frame-options") and not h.get("content-security-policy"):
        missing.append("X-Frame-Options")
    if h.get("_https") == "1" and not h.get("strict-transport-security"):
        missing.append("Strict-Transport-Security")
    return missing
