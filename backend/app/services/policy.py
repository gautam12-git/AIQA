"""Action policy gate (vision §23, §48).

The LLM proposes actions; this gate decides whether they may run. It is the
non-negotiable layer between "AI wants to click X" and the browser actually
doing it. Deterministic — never an LLM decision.

Tiers:
  SAFE      navigate, read, screenshot, inspect, GET
  CAUTION   form submit, click that mutates, POST/PUT/PATCH/DELETE, upload
  HIGH_RISK payments, account deletion, sending real email, prod writes

Rules:
  - HIGH_RISK is denied unless the environment is a safe test env AND the run
    mode explicitly opts in.
  - In production, only SAFE is allowed (read-limited).
  - CAUTION allowed in test envs; denied in production.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Risk(str, Enum):
    SAFE = "safe"
    CAUTION = "caution"
    HIGH_RISK = "high-risk"


# Tool name → base risk tier.
TOOL_RISK: dict[str, Risk] = {
    "open_page": Risk.SAFE,
    "read_dom": Risk.SAFE,
    "read_console": Risk.SAFE,
    "read_network": Risk.SAFE,
    "screenshot": Risk.SAFE,
    "get_links": Risk.SAFE,
    "call_api_get": Risk.SAFE,
    "click": Risk.CAUTION,
    "type_text": Risk.CAUTION,
    "submit_form": Risk.CAUTION,
    "call_api_write": Risk.CAUTION,
    "upload_file": Risk.CAUTION,
}

# Keywords that escalate a CAUTION action to HIGH_RISK.
_HIGH_RISK_HINTS = (
    "pay", "purchase", "checkout", "delete account", "close account",
    "wire", "transfer", "refund", "charge", "billing", "subscribe",
)

_TEST_ENVS = {"staging", "local", "qa"}
_HIGH_RISK_MODES = {"security", "full-autonomous"}


@dataclass
class Decision:
    allowed: bool
    risk: Risk
    reason: str


def classify(tool: str, target: str = "") -> Risk:
    base = TOOL_RISK.get(tool, Risk.CAUTION)
    if base is Risk.CAUTION and any(h in target.lower() for h in _HIGH_RISK_HINTS):
        return Risk.HIGH_RISK
    return base


def check(tool: str, environment: str, mode: str, target: str = "") -> Decision:
    risk = classify(tool, target)

    if environment == "production":
        if risk is Risk.SAFE:
            return Decision(True, risk, "safe read allowed in production")
        return Decision(False, risk, "production is read-limited; non-safe action blocked")

    if risk is Risk.SAFE:
        return Decision(True, risk, "safe")
    if risk is Risk.CAUTION:
        return Decision(True, risk, "caution action allowed in test environment")
    # HIGH_RISK
    if environment in _TEST_ENVS and mode in _HIGH_RISK_MODES:
        return Decision(True, risk, "high-risk permitted: test env + opted-in mode")
    return Decision(False, risk, "high-risk requires a safe test env and an opted-in mode")
