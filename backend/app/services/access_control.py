"""Broken access control check (auth testing, phase 1).

After an authenticated crawl, take the protected-looking pages AIQA reached
while logged in and request them again ANONYMOUSLY. If a page that should be
behind the login still returns real content to a logged-out request, that's a
broken-access-control finding (OWASP A01).

Heuristic and conservative — flagged with medium confidence, since some pages
are legitimately public.
"""

from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx

from app.schemas import Bug, Evidence, NetworkEvidence, ReproStep
from app.services.browser import PageReport

_PROTECTED_HINTS = ("account", "dashboard", "admin", "settings", "profile",
                    "secure", "orders", "billing", "users", "me", "app")
_LOGIN_MARKERS = ("type=\"password\"", "type='password'", "sign in", "log in",
                  "login", "sign-in", "password")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _looks_protected(url: str) -> bool:
    path = urlparse(url).path.lower()
    segs = [s for s in path.split("/") if s]
    return any(h in segs for h in _PROTECTED_HINTS)


async def check_broken_access(
    reports: list[PageReport], run_id: str, project_id: str, environment: str,
) -> list[Bug]:
    candidates = [r for r in reports if r.status and 200 <= r.status < 400 and _looks_protected(r.url)]
    if not candidates:
        return []

    bugs: list[Bug] = []
    seq = 0
    async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
        for r in candidates[:12]:
            try:
                # Anonymous request — no cookies, no auth.
                resp = await client.get(r.url, headers={"Cookie": ""})
            except Exception:
                continue
            final = str(resp.url)
            body = resp.text.lower()
            redirected_to_login = any(k in final.lower() for k in ("login", "signin", "sign-in"))
            looks_like_login = any(m in body for m in _LOGIN_MARKERS)
            # Bug: protected URL returns 200 with real content, not a login page/redirect.
            if resp.status_code == 200 and not redirected_to_login and not looks_like_login and len(body) > 400:
                seq += 1
                bugs.append(Bug(
                    id=f"AIQAA-{run_id.replace('run_', '')}-{seq:03d}",
                    project_id=project_id, run_id=run_id, environment=environment, created_at=_now(),
                    title=f"Protected page reachable without authentication: {urlparse(r.url).path}",
                    severity="P1", confidence="medium", category="security",
                    affected_url=r.url,
                    description=("This page was reached while logged in and looks account-scoped, "
                                 "but an anonymous request (no session) still returns full content."),
                    expected_behavior="Anonymous access is redirected to login or returns 401/403.",
                    actual_behavior=f"Anonymous GET returned HTTP {resp.status_code} with page content.",
                    repro_steps=[
                        ReproStep(n=1, action="Log out / clear cookies"),
                        ReproStep(n=2, action="GET", target=r.url),
                        ReproStep(n=3, action="Observe", detail=f"HTTP {resp.status_code}, content served"),
                    ],
                    evidence=Evidence(
                        expected="302→login or 401/403", actual=f"200 ({len(body)} bytes)",
                        network=[NetworkEvidence(method="GET", url=r.url, status=resp.status_code, duration_ms=0)]),
                    impact="Sensitive/authenticated content may be exposed to unauthenticated users.",
                    suggested_fix="Enforce an authentication check server-side on this route.",
                    frequency="1 anonymous request", status="open",
                ))
    return bugs
