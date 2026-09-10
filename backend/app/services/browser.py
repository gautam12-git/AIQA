"""Browser layer — real Playwright/Chromium crawl with evidence capture.

Visits same-origin pages breadth-first up to a budget, recording per page:
final HTTP status, console errors, uncaught JS exceptions, every sub-resource
response (to catch broken images/scripts), security headers, links, and a
screenshot. This telemetry is what the deterministic detectors reason over —
evidence over opinion (vision §2.3).
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from urllib.parse import urldefrag, urljoin, urlparse

from playwright.async_api import async_playwright


@dataclass
class ResourceHit:
    url: str
    status: int
    resource_type: str


@dataclass
class ConsoleMsg:
    level: str
    text: str


@dataclass
class PageReport:
    url: str
    status: int
    title: str = ""
    load_ms: int = 0
    console: list[ConsoleMsg] = field(default_factory=list)
    page_errors: list[str] = field(default_factory=list)
    resources: list[ResourceHit] = field(default_factory=list)
    security_headers: dict[str, str] = field(default_factory=dict)
    links: list[str] = field(default_factory=list)
    screenshot_path: str | None = None
    # --- richer telemetry captured while the page is open (P2 engines) ---
    a11y: list[dict] = field(default_factory=list)   # WCAG issues found in the DOM
    buttons: int = 0                                  # interactive elements discovered
    forms: int = 0
    weak_forms: int = 0                               # forms w/ required fields, no constraints
    ttfb_ms: int = 0                                  # Navigation Timing responseStart
    lcp_ms: int = 0                                   # Largest Contentful Paint
    info_headers: dict[str, str] = field(default_factory=dict)  # CORS / server disclosure


# Registered before navigation so the LCP observer is buffering from the start.
_LCP_INIT = """
(() => {
  window.__aiqa = { lcp: 0 };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__aiqa.lcp = Math.round(e.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
})();
"""

# One in-page audit: real WCAG checks, element counts for coverage, web vitals.
_AUDIT_JS = r"""
() => {
  const q = (s) => Array.from(document.querySelectorAll(s));
  const issues = [];
  const add = (rule, count, impact, desc) => { if (count) issues.push({rule, count, impact, desc}); };

  add('image-alt', q('img:not([alt])').length, 'serious', 'images without an alt attribute');

  let noLabel = 0;
  for (const el of q('input:not([type=hidden]),select,textarea')) {
    const id = el.getAttribute('id');
    let hasFor = false;
    try { hasFor = !!(id && document.querySelector('label[for="' + CSS.escape(id) + '"]')); } catch (e) {}
    const wrapped = !!el.closest('label');
    const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title');
    if (!hasFor && !wrapped && !aria) noLabel++;
  }
  add('label', noLabel, 'serious', 'form fields without an associated label');

  let btnNoName = 0;
  for (const el of q('button,[role=button]')) {
    const t = (el.innerText || el.value || '').trim();
    const aria = el.getAttribute('aria-label') || el.getAttribute('title');
    if (!t && !aria) btnNoName++;
  }
  add('button-name', btnNoName, 'serious', 'buttons without an accessible name');

  let emptyLinks = 0;
  for (const el of q('a[href]')) {
    const t = (el.innerText || '').trim();
    const aria = el.getAttribute('aria-label') || el.getAttribute('title');
    if (!t && !aria) emptyLinks++;
  }
  add('link-name', emptyLinks, 'moderate', 'links without discernible text');

  if (!document.documentElement.getAttribute('lang')) add('html-lang', 1, 'serious', '<html> is missing a lang attribute');
  if (!document.title || !document.title.trim()) add('document-title', 1, 'serious', 'page has no <title>');

  const ids = {}; let dup = 0;
  for (const el of q('[id]')) { const i = el.id; if (i) { ids[i] = (ids[i]||0)+1; if (ids[i] === 2) dup++; } }
  add('duplicate-id', dup, 'minor', 'duplicate element ids');

  // Coverage counts
  const buttons = q('button,[role=button],input[type=submit],input[type=button]').length;
  const forms = q('form').length;

  // Forms with required fields but no client validation constraint
  let weakForms = 0;
  for (const f of q('form')) {
    for (const el of Array.from(f.querySelectorAll('input,select,textarea'))) {
      const ty = (el.getAttribute('type') || '').toLowerCase();
      if (['hidden','submit','button','reset'].includes(ty)) continue;
      if (!el.hasAttribute('required')) continue;
      const constrained = el.hasAttribute('pattern') || el.hasAttribute('minlength') ||
        el.hasAttribute('maxlength') || el.hasAttribute('min') || el.hasAttribute('max') ||
        ['email','url','number','tel','date'].includes(ty);
      if (!constrained) { weakForms++; break; }
    }
  }

  // Web vitals
  let ttfb = 0;
  try { const n = performance.getEntriesByType('navigation')[0]; if (n) ttfb = Math.round(n.responseStart); } catch (e) {}
  const lcp = (window.__aiqa && window.__aiqa.lcp) || 0;

  return { issues, buttons, forms, weakForms, ttfb, lcp };
}
"""


def _norm(url: str) -> str:
    return urldefrag(url)[0].rstrip("/") or url


def _same_origin(a: str, b: str) -> bool:
    pa, pb = urlparse(a), urlparse(b)
    return (pa.scheme, pa.netloc) == (pb.scheme, pb.netloc)


async def scan_pages(
    start_url: str,
    max_pages: int,
    screenshot_dir: str | None = None,
    storage_state: dict | None = None,
) -> list[PageReport]:
    reports: list[PageReport] = []
    seen: set[str] = set()
    queue: deque[str] = deque([_norm(start_url)])

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # storage_state carries an authenticated session when provided.
        context = await browser.new_context(
            ignore_https_errors=True,
            storage_state=storage_state if storage_state else None,
        )
        await context.add_init_script(_LCP_INIT)  # LCP observer, buffered from load

        while queue and len(reports) < max_pages:
            url = queue.popleft()
            if url in seen:
                continue
            seen.add(url)

            page = await context.new_page()
            resources: list[ResourceHit] = []
            console: list[ConsoleMsg] = []
            page_errors: list[str] = []

            page.on("response", lambda r: resources.append(
                ResourceHit(url=r.url, status=r.status, resource_type=r.request.resource_type)))
            page.on("console", lambda m: console.append(ConsoleMsg(level=m.type, text=m.text)))
            page.on("pageerror", lambda e: page_errors.append(str(e)))

            t0 = time.monotonic()
            main_status = 0
            headers: dict[str, str] = {}
            try:
                resp = await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                if resp:
                    main_status = resp.status
                    headers = {k.lower(): v for k, v in (await resp.all_headers()).items()}
            except Exception as exc:
                page_errors.append(f"navigation failed: {exc}")
            load_ms = int((time.monotonic() - t0) * 1000)

            title = ""
            links: list[str] = []
            shot_path = None
            audit: dict = {}
            try:
                title = await page.title()
                hrefs = await page.eval_on_selector_all(
                    "a[href]", "els => els.map(e => e.href)")
                links = [_norm(h) for h in hrefs if h.startswith("http")]
                # Let LCP settle briefly, then run the single in-page audit.
                try:
                    await page.wait_for_timeout(400)
                    audit = await page.evaluate(_AUDIT_JS) or {}
                except Exception:
                    audit = {}
                if screenshot_dir:
                    import os
                    os.makedirs(screenshot_dir, exist_ok=True)
                    shot_path = os.path.join(screenshot_dir, f"page-{len(reports)}.png")
                    await page.screenshot(path=shot_path, full_page=False)
            except Exception:
                pass

            reports.append(PageReport(
                url=url, status=main_status, title=title, load_ms=load_ms,
                console=console, page_errors=page_errors, resources=resources,
                security_headers=_security_headers(url, headers), links=links,
                screenshot_path=shot_path,
                a11y=audit.get("issues", []) or [],
                buttons=int(audit.get("buttons", 0) or 0),
                forms=int(audit.get("forms", 0) or 0),
                weak_forms=int(audit.get("weakForms", 0) or 0),
                ttfb_ms=int(audit.get("ttfb", 0) or 0),
                lcp_ms=int(audit.get("lcp", 0) or 0),
                info_headers=_info_headers(headers),
            ))

            # Enqueue same-origin links.
            for link in links:
                if link not in seen and _same_origin(start_url, link):
                    queue.append(link)

            await page.close()

        await context.close()
        await browser.close()

    return reports


def _security_headers(url: str, headers: dict[str, str]) -> dict[str, str]:
    """Snapshot the security-relevant response headers (present or empty)."""
    keys = [
        "content-security-policy",
        "x-content-type-options",
        "x-frame-options",
        "strict-transport-security",
        "referrer-policy",
    ]
    snap = {k: headers.get(k, "") for k in keys}
    snap["_https"] = "1" if urlparse(url).scheme == "https" else "0"
    return snap


def _info_headers(headers: dict[str, str]) -> dict[str, str]:
    """Headers relevant to API/security checks: CORS + server disclosure."""
    keys = [
        "access-control-allow-origin",
        "access-control-allow-credentials",
        "server",
        "x-powered-by",
        "x-aspnet-version",
    ]
    return {k: headers.get(k, "") for k in keys if headers.get(k)}
