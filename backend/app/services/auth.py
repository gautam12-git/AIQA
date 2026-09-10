"""Authentication — log AIQA into the target so it can test behind the login.

Given a start URL + credentials, it finds a standard username/password login
form, submits it, verifies success, and returns the authenticated session
(Playwright storage_state = cookies + local storage). That state is then used
to crawl and test protected pages.

Scope: standard form logins (username/email + password). OAuth/SSO/complex SPA
logins are out of scope for now — it reports honestly when it can't log in.
Credentials live only in memory for the run; they are never persisted.
"""

from __future__ import annotations

import re
from urllib.parse import urljoin, urlparse

from playwright.async_api import Page, async_playwright

_LOGIN_PATHS = ["/login", "/signin", "/sign-in", "/account/login",
                "/users/sign_in", "/auth/login", "/session/new"]
_USER_SELECTORS = [
    "input[type=email]", "input[name*=email i]", "input[name*=user i]",
    "input[id*=user i]", "input[name=login]", "input[autocomplete=username]",
]


async def _has_password(page: Page) -> bool:
    return await page.locator("input[type=password]").count() > 0


async def _goto_login(page: Page, start_url: str) -> bool:
    try:
        await page.goto(start_url, wait_until="domcontentloaded", timeout=20000)
    except Exception:
        return False
    if await _has_password(page):
        return True
    # try a visible login link
    for pat in ("log in", "login", "sign in", "signin"):
        try:
            link = page.get_by_role("link", name=re.compile(pat, re.I)).first
            if await link.count() > 0:
                await link.click(timeout=5000)
                await page.wait_for_load_state("domcontentloaded", timeout=8000)
                if await _has_password(page):
                    return True
        except Exception:
            pass
    # try common login paths
    base = f"{urlparse(start_url).scheme}://{urlparse(start_url).netloc}"
    for path in _LOGIN_PATHS:
        try:
            await page.goto(urljoin(base, path), wait_until="domcontentloaded", timeout=12000)
            if await _has_password(page):
                return True
        except Exception:
            continue
    return False


async def _fill_and_submit(page: Page, username: str, password: str) -> None:
    # username
    for sel in _USER_SELECTORS:
        loc = page.locator(sel).first
        try:
            if await loc.count() > 0:
                await loc.fill(username, timeout=5000)
                break
        except Exception:
            continue
    # password
    try:
        await page.locator("input[type=password]").first.fill(password, timeout=5000)
    except Exception:
        return
    # submit
    for sel in ("button[type=submit]", "input[type=submit]"):
        loc = page.locator(sel).first
        try:
            if await loc.count() > 0:
                await loc.click(timeout=5000)
                await page.wait_for_load_state("domcontentloaded", timeout=10000)
                return
        except Exception:
            pass
    for pat in ("log in", "login", "sign in", "submit"):
        try:
            btn = page.get_by_role("button", name=re.compile(pat, re.I)).first
            if await btn.count() > 0:
                await btn.click(timeout=5000)
                await page.wait_for_load_state("domcontentloaded", timeout=10000)
                return
        except Exception:
            pass
    # last resort: Enter in the password field
    try:
        await page.locator("input[type=password]").first.press("Enter")
        await page.wait_for_load_state("domcontentloaded", timeout=10000)
    except Exception:
        pass


_LOGOUT_MARKERS = ("log out", "logout", "sign out", "signout")
_ERROR_MARKERS = (
    "invalid", "incorrect", "wrong password", "wrong username", "try again",
    "not recognized", "does not match", "authentication failed", "login failed",
    "invalid credentials", "please enter a valid",
)


def _norm_url(u: str) -> str:
    return (u or "").split("#")[0].rstrip("/")


async def _looks_logged_in(page: Page, login_url: str) -> bool:
    """Confirm a successful login on real evidence, not just an absent field.

    A missing password field alone is not proof — an error redirect also lacks
    one. Require a genuine positive signal and the absence of an error message.
    """
    try:
        body = (await page.evaluate("() => document.body ? document.body.innerText : ''")).lower()
    except Exception:
        body = ""
    # Strong positive: an explicit sign-out affordance means we're inside.
    if any(k in body for k in _LOGOUT_MARKERS):
        return True
    # Explicit failure message → definitely not logged in.
    if any(k in body for k in _ERROR_MARKERS):
        return False
    # Otherwise require BOTH: we navigated away from the login page AND the
    # password field is gone. Either one alone is too weak.
    moved = _norm_url(page.url) != _norm_url(login_url)
    return moved and not await _has_password(page)


async def authenticate(start_url: str, username: str, password: str) -> tuple[dict | None, str]:
    """Return (storage_state, detail). storage_state is None if login failed."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(ignore_https_errors=True)
        page = await ctx.new_page()
        try:
            if not await _goto_login(page, start_url):
                return None, "no standard login form found"
            login_url = page.url  # remember where the form lived
            await _fill_and_submit(page, username, password)
            ok = await _looks_logged_in(page, login_url)
            if not ok:
                return None, "login submitted but session not confirmed (wrong creds or non-standard login)"
            state = await ctx.storage_state()
            return state, f"logged in as {username}"
        except Exception as exc:
            return None, f"login error: {str(exc)[:120]}"
        finally:
            await browser.close()
