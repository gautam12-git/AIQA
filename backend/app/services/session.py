"""Interactive browser session — the tool layer the LLM agent drives.

A single Chromium page kept open across steps, exposing the tools from the
vision doc (§24): open_page, get_links, read_dom, read_console, read_network,
screenshot, click, type_text, submit_form. Console and network are captured
continuously so every action leaves evidence.

DOM/text returned here is UNTRUSTED (it comes from the tested site). The agent
prompt fences it as data — never instructions (prompt-injection defense, §20).
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field

from playwright.async_api import Browser, Page, async_playwright


@dataclass
class NetEntry:
    method: str
    url: str
    status: int
    resource_type: str


@dataclass
class ConEntry:
    level: str
    text: str


@dataclass
class SessionState:
    console: list[ConEntry] = field(default_factory=list)
    network: list[NetEntry] = field(default_factory=list)


class BrowserSession:
    def __init__(self, environment: str, screenshot_dir: str | None = None,
                 storage_state: dict | None = None):
        self.environment = environment
        self.screenshot_dir = screenshot_dir
        self.storage_state = storage_state  # authenticated session (cookies) if any
        self._pw = None
        self._browser: Browser | None = None
        self._page: Page | None = None
        self.state = SessionState()
        self._shot_n = 0

    async def start(self) -> None:
        self._pw = await async_playwright().start()
        self._browser = await self._pw.chromium.launch(headless=True)
        context = await self._browser.new_context(
            ignore_https_errors=True, storage_state=self.storage_state)
        self._page = await context.new_page()
        self._page.on("console", lambda m: self.state.console.append(ConEntry(m.type, m.text[:300])))
        self._page.on("response", lambda r: self.state.network.append(
            NetEntry(r.request.method, r.url, r.status, r.request.resource_type)))

    async def close(self) -> None:
        try:
            if self._browser:
                await self._browser.close()
            if self._pw:
                await self._pw.stop()
        except Exception:
            pass

    @property
    def page(self) -> Page:
        assert self._page is not None, "session not started"
        return self._page

    # ---- Tools ------------------------------------------------------

    async def open_page(self, url: str) -> dict:
        t0 = time.monotonic()
        status = 0
        try:
            resp = await self.page.goto(url, wait_until="domcontentloaded", timeout=20000)
            status = resp.status if resp else 0
        except Exception as exc:
            return {"ok": False, "error": str(exc)[:200], "url": url}
        return {"ok": True, "url": self.page.url, "status": status,
                "title": await self.page.title(), "loadMs": int((time.monotonic() - t0) * 1000)}

    async def get_links(self) -> dict:
        hrefs = await self.page.eval_on_selector_all("a[href]", "els => els.map(e => e.href)")
        uniq = sorted({h for h in hrefs if h.startswith("http")})
        return {"links": uniq[:60], "count": len(uniq)}

    async def read_dom(self, max_chars: int = 2500) -> dict:
        text = await self.page.evaluate("() => document.body ? document.body.innerText : ''")
        forms = await self.page.eval_on_selector_all(
            "form", "els => els.map(f => ({action: f.action, method: f.method, "
            "fields: Array.from(f.elements).map(e => e.name || e.type).filter(Boolean)}))")
        return {"text": text[:max_chars], "truncated": len(text) > max_chars, "forms": forms[:8]}

    async def read_console(self) -> dict:
        return {"messages": [{"level": c.level, "text": c.text} for c in self.state.console[-30:]]}

    async def read_network(self) -> dict:
        return {"requests": [
            {"method": n.method, "url": n.url, "status": n.status, "type": n.resource_type}
            for n in self.state.network[-40:]]}

    async def screenshot(self, label: str = "") -> dict:
        if not self.screenshot_dir:
            return {"ok": False, "error": "no screenshot dir"}
        os.makedirs(self.screenshot_dir, exist_ok=True)
        self._shot_n += 1
        name = f"agent-{self._shot_n}.png"
        await self.page.screenshot(path=os.path.join(self.screenshot_dir, name))
        return {"ok": True, "file": name, "label": label}

    async def click(self, text: str = "", selector: str = "") -> dict:
        try:
            if selector:
                await self.page.click(selector, timeout=8000)
            else:
                await self.page.get_by_text(text, exact=False).first.click(timeout=8000)
            await self.page.wait_for_load_state("domcontentloaded", timeout=8000)
            return {"ok": True, "url": self.page.url}
        except Exception as exc:
            return {"ok": False, "error": str(exc)[:200]}

    async def type_text(self, selector: str, value: str) -> dict:
        try:
            await self.page.fill(selector, value, timeout=8000)
            return {"ok": True}
        except Exception as exc:
            return {"ok": False, "error": str(exc)[:200]}

    async def submit_form(self, selector: str = "form") -> dict:
        try:
            await self.page.eval_on_selector(selector, "f => f.requestSubmit ? f.requestSubmit() : f.submit()")
            await self.page.wait_for_load_state("domcontentloaded", timeout=8000)
            return {"ok": True, "url": self.page.url}
        except Exception as exc:
            return {"ok": False, "error": str(exc)[:200]}
