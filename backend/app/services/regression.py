"""Regression detection — flag findings that newly broke since a prior run.

A finding is a regression when the same (category, path) signature was NOT
present in the project's previous completed run, yet that page WAS crawled then
(so it was effectively clean for this category before and has since broken).
Conservative by design: a finding on a page never seen before is "new", not a
regression, and a finding that also existed last time is persistent, not one.
"""

from __future__ import annotations

from urllib.parse import urlparse

from app.schemas import Bug


def _path(url: str | None) -> str:
    if not url:
        return ""
    p = urlparse(url)
    return (p.netloc + (p.path or "/")).rstrip("/")


def _sig(b: Bug) -> tuple[str, str]:
    return (b.category, _path(b.affected_url))


def mark_regressions(current: list[Bug], prev_bugs: list[Bug], prev_urls: list[str]) -> int:
    """Set `is_regression=True` on newly-broken findings. Returns the count."""
    prev_sigs = {_sig(b) for b in prev_bugs}
    prev_paths = {_path(u) for u in prev_urls}
    n = 0
    for b in current:
        if not b.affected_url:
            continue
        if _sig(b) in prev_sigs:          # existed last run → persistent, not new
            continue
        if _path(b.affected_url) in prev_paths:  # page was tested before, clean then
            b.is_regression = True
            n += 1
    return n
