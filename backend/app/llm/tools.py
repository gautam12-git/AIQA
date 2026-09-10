"""Tool schemas (OpenAI function-calling format) + policy-gated dispatch.

The agent proposes a tool call; `dispatch` runs it through the policy gate
before touching the browser. Denied actions return a structured refusal the
model can read and adapt to — the gate is authoritative, not the LLM.
"""

from __future__ import annotations

from typing import Any

from app.services import policy
from app.services.session import BrowserSession


def _fn(name: str, desc: str, props: dict, required: list[str]) -> dict:
    return {"type": "function", "function": {
        "name": name, "description": desc,
        "parameters": {"type": "object", "properties": props, "required": required}}}


TOOL_SCHEMAS: list[dict] = [
    _fn("open_page", "Navigate to a URL and load it.",
        {"url": {"type": "string"}}, ["url"]),
    _fn("get_links", "List same-page links (hrefs).", {}, []),
    _fn("read_dom", "Read the page's visible text and form structure.",
        {"max_chars": {"type": "integer"}}, []),
    _fn("read_console", "Read recent browser console messages.", {}, []),
    _fn("read_network", "Read recent network requests and their statuses.", {}, []),
    _fn("screenshot", "Capture a screenshot as evidence.",
        {"label": {"type": "string"}}, []),
    _fn("click", "Click an element by visible text (or CSS selector).",
        {"text": {"type": "string"}, "selector": {"type": "string"}}, []),
    _fn("type_text", "Type a value into a field by CSS selector.",
        {"selector": {"type": "string"}, "value": {"type": "string"}}, ["selector", "value"]),
    _fn("submit_form", "Submit a form by CSS selector (default 'form').",
        {"selector": {"type": "string"}}, []),
    _fn("report_bug",
        "Record a suspected defect with evidence. It will be verified before surfacing.",
        {"title": {"type": "string"}, "severity": {"type": "string", "enum": ["P0", "P1", "P2", "P3"]},
         "category": {"type": "string"}, "affected_url": {"type": "string"},
         "description": {"type": "string"}, "expected": {"type": "string"},
         "actual": {"type": "string"}, "repro_steps": {"type": "array", "items": {"type": "string"}}},
        ["title", "severity", "category", "description", "expected", "actual"]),
    _fn("finish", "End the exploration when coverage is sufficient.",
        {"summary": {"type": "string"}}, []),
]

# Tools handled by the loop itself, not the browser session.
CONTROL_TOOLS = {"report_bug", "finish"}


async def dispatch(
    session: BrowserSession, environment: str, mode: str, name: str, args: dict[str, Any],
) -> dict:
    if name in CONTROL_TOOLS:
        return {"_control": name, "args": args}

    target = args.get("url") or args.get("text") or args.get("selector") or ""
    decision = policy.check(name, environment, mode, target)
    if not decision.allowed:
        return {"ok": False, "denied": True, "risk": decision.risk.value, "reason": decision.reason}

    method = getattr(session, name, None)
    if method is None:
        return {"ok": False, "error": f"unknown tool {name}"}
    try:
        return await method(**args)
    except TypeError as exc:
        return {"ok": False, "error": f"bad args: {exc}"}
