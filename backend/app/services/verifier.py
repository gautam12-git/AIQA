"""Verification engine — confirm findings by replay before surfacing them.

This is the product moat (vision §27, §60): the difference between a noisy
scanner and a trustworthy QA engineer is refusing to report a defect until it
reproduces.

What gets verified, and how:
  - HTTP failures (5xx/4xx pages, broken images, failed scripts/styles): the
    failing request is re-sent N times — confirmed only if the failure
    reproduces every time. Replays carry the authenticated session's cookies,
    so a real failure on a logged-in page is NOT mistaken for a login redirect.
  - LLM-proposed ("suspected") findings with no reproducible HTTP signal cannot
    be confirmed this cheaply, so they are downgraded to `low` and never
    surfaced — the LLM never gets the last word.
  - Deterministic browser observations that need a real browser to re-check
    (console errors, uncaught JS exceptions, missing security headers, a
    single slow-load sample): kept at their observed confidence. They were
    captured from a real page load and carry their own evidence; we simply do
    not claim to have replayed them.
"""

from __future__ import annotations

import httpx

from app.schemas import Bug

_REPLAYS = 2


def _cookies_from_state(storage_state: dict | None) -> httpx.Cookies:
    """Build an httpx cookie jar from a Playwright storage_state."""
    jar = httpx.Cookies()
    if not storage_state:
        return jar
    for c in storage_state.get("cookies", []):
        try:
            jar.set(
                c["name"], c.get("value", ""),
                domain=(c.get("domain") or "").lstrip("."),
                path=c.get("path") or "/",
            )
        except Exception:
            continue
    return jar


async def verify(bugs: list[Bug], storage_state: dict | None = None) -> None:
    """Mutate bugs in place: upgrade/downgrade confidence based on replay.

    When `storage_state` is provided, replays run as the authenticated user so
    findings on protected pages reproduce instead of redirecting to login.
    """
    cookies = _cookies_from_state(storage_state)
    async with httpx.AsyncClient(follow_redirects=True, timeout=15, cookies=cookies) as client:
        for bug in bugs:
            await _verify_one(bug, client)


async def _verify_one(bug: Bug, client: httpx.AsyncClient) -> None:
    net = bug.evidence.network or []

    # 1) HTTP-failure findings — replay the failing request and confirm on repro.
    failing = next((n for n in net if n.status >= 400 and n.url), None)
    if failing is not None:
        url = failing.url if failing.url.startswith("http") else bug.affected_url
        if url:
            reproduced = 0
            total = 1 + _REPLAYS
            for _ in range(total):
                try:
                    resp = await client.request(failing.method or "GET", url)
                    if resp.status_code == failing.status:
                        reproduced += 1
                except Exception:
                    pass
            if reproduced == total:
                bug.confidence = "confirmed"
                bug.status = "confirmed"
                bug.frequency = f"{reproduced}/{total} reproductions"
            elif reproduced == 0:
                # Could not reproduce — do not present as a real finding.
                bug.confidence = "low"
                bug.frequency = f"0/{total} reproductions (transient?)"
            else:
                bug.confidence = "medium"
                bug.frequency = f"{reproduced}/{total} reproductions (intermittent)"
            return

    # 2) LLM-proposed with no reproducible signal — cannot confirm → do not surface.
    if bug.confidence == "suspected":
        bug.confidence = "low"
        bug.frequency = "unverified — no reproducible signal"
        return

    # 3) Deterministic browser-observed findings (console, JS errors, headers,
    #    single slow-load sample): keep observed confidence; captured live.
    return
