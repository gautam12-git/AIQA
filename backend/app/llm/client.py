"""Provider-agnostic LLM client with fallback.

AIQA talks to one interface (`get_llm().chat(...)`). Behind it sits an ordered
list of OpenAI-compatible providers; `chat()` tries each until one succeeds, so
a single provider being rate-limited, out of credits, or down never takes the
AI layer offline.

Providers supported:
  - openai : OpenAI Chat Completions API.
  - anthropic : Anthropic Messages API, translated to the shared chat/tool format.
  - nvidia : NVIDIA NIM (integrate.api.nvidia.com), bearer auth.
  - glm    : GLM 5.3 Flash behind a Modal endpoint, Modal-Key/Secret auth
             (or bearer if a plain key is set).

Order is controlled by LLM_ORDER (default "openai,anthropic").
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Optional

import httpx

from app.config import get_settings

log = logging.getLogger("aiqa.llm")


@dataclass
class Provider:
    name: str
    base_url: str
    model: str
    auth_mode: str = "bearer"  # "bearer" | "modal"
    api_key: str = ""
    modal_key: str = ""
    modal_secret: str = ""
    protocol: str = "openai"
    api_version: str = ""

    def configured(self) -> bool:
        if not self.base_url or not self.model:
            return False
        if self.auth_mode == "modal":
            return bool(self.modal_key and self.modal_secret)
        return bool(self.api_key)

    def headers(self) -> dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.auth_mode == "modal":
            h["Modal-Key"] = self.modal_key
            h["Modal-Secret"] = self.modal_secret
        else:
            h["Authorization"] = f"Bearer {self.api_key}"
        if self.protocol == "anthropic":
            h.pop("Authorization", None)
            h["x-api-key"] = self.api_key
            h["anthropic-version"] = self.api_version or "2023-06-01"
        return h


class LLMClient:
    def __init__(self, providers: list[Provider], max_tokens: int = 4096):
        self.providers = [p for p in providers if p.configured()]
        self.max_tokens = max_tokens

    @property
    def configured(self) -> bool:
        return bool(self.providers)

    @property
    def provider_names(self) -> list[str]:
        return [p.name for p in self.providers]

    async def chat(
        self,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]] = None,
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        """One chat completion, trying each provider in order until success."""
        if not self.providers:
            raise RuntimeError("No LLM provider is configured.")

        errors: list[str] = []
        # NVIDIA's shared tier can take ~40s for reasoning models; give headroom.
        async with httpx.AsyncClient(timeout=150) as http:
            for p in self.providers:
                payload: dict[str, Any] = {
                    "model": p.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": self.max_tokens,
                    "stream": False,
                }
                if tools:
                    payload["tools"] = tools
                    payload["tool_choice"] = "auto"
                try:
                    if p.protocol == "anthropic":
                        endpoint = f"{p.base_url.rstrip('/')}/messages"
                        request_payload = _to_anthropic(payload)
                    else:
                        endpoint = f"{p.base_url.rstrip('/')}/chat/completions"
                        request_payload = payload
                    resp = await http.post(endpoint, headers=p.headers(), json=request_payload)
                    resp.raise_for_status()
                    data = resp.json()
                    if p.protocol == "anthropic":
                        data = _from_anthropic(data)
                    if not (data.get("choices")):
                        raise RuntimeError("empty choices")
                    log.info("LLM ok via %s (%s)", p.name, p.model)
                    return data
                except Exception as exc:
                    errors.append(f"{p.name}: {str(exc)[:120]}")
                    log.warning("LLM provider %s failed: %s", p.name, str(exc)[:160])
                    continue
        raise RuntimeError("all LLM providers failed — " + "; ".join(errors))


@lru_cache
def get_llm() -> LLMClient:
    s = get_settings()
    catalog: dict[str, Provider] = {
        "openai": Provider(
            name="openai", base_url=s.openai_base_url, model=s.openai_model,
            auth_mode="bearer", api_key=s.openai_api_key),
        "anthropic": Provider(
            name="anthropic", base_url=s.anthropic_base_url, model=s.anthropic_model,
            auth_mode="bearer", api_key=s.anthropic_api_key,
            protocol="anthropic", api_version=s.anthropic_version),
        "nvidia": Provider(
            name="nvidia", base_url=s.nvidia_base_url, model=s.nvidia_model,
            auth_mode="bearer", api_key=s.nvidia_api_key),
        "glm": Provider(
            name="glm", base_url=s.glm_base_url, model=s.glm_model,
            auth_mode=s.llm_auth_mode, api_key=s.glm_api_key,
            modal_key=s.modal_key, modal_secret=s.modal_secret),
    }
    order = [name.strip() for name in s.llm_order.split(",") if name.strip()]
    providers = [catalog[n] for n in order if n in catalog]
    return LLMClient(providers, max_tokens=s.llm_max_tokens)


def _to_anthropic(payload: dict[str, Any]) -> dict[str, Any]:
    """Translate shared OpenAI-style messages and tools to Anthropic Messages."""
    system_parts: list[str] = []
    messages: list[dict[str, Any]] = []
    for message in payload.get("messages", []):
        role = message.get("role")
        content = message.get("content") or ""
        if role == "system":
            system_parts.append(str(content))
        elif role == "tool":
            messages.append({"role": "user", "content": [{
                "type": "tool_result", "tool_use_id": message.get("tool_call_id", ""),
                "content": str(content),
            }]})
        elif role == "assistant" and message.get("tool_calls"):
            blocks: list[dict[str, Any]] = []
            if content:
                blocks.append({"type": "text", "text": str(content)})
            for call in message["tool_calls"]:
                fn = call.get("function", {})
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except (TypeError, json.JSONDecodeError):
                    args = {}
                blocks.append({"type": "tool_use", "id": call.get("id", ""),
                               "name": fn.get("name", ""), "input": args})
            messages.append({"role": "assistant", "content": blocks})
        elif role in ("user", "assistant"):
            messages.append({"role": role, "content": content})

    request: dict[str, Any] = {
        "model": payload["model"], "messages": messages,
        "max_tokens": payload.get("max_tokens", 4096),
    }
    if system_parts:
        request["system"] = "\n\n".join(system_parts)
    if "temperature" in payload:
        request["temperature"] = payload["temperature"]
    if payload.get("tools"):
        request["tools"] = [{
            "name": tool.get("function", {}).get("name", ""),
            "description": tool.get("function", {}).get("description", ""),
            "input_schema": tool.get("function", {}).get("parameters", {"type": "object"}),
        } for tool in payload["tools"]]
    if payload.get("tool_choice") == "auto":
        request["tool_choice"] = {"type": "auto"}
    return request


def _from_anthropic(data: dict[str, Any]) -> dict[str, Any]:
    """Translate Anthropic text/tool-use blocks into the client's chat format."""
    text_parts: list[str] = []
    tool_calls: list[dict[str, Any]] = []
    for index, block in enumerate(data.get("content", [])):
        if block.get("type") == "text":
            text_parts.append(block.get("text", ""))
        elif block.get("type") == "tool_use":
            tool_calls.append({
                "id": block.get("id", f"tool_{index}"), "type": "function",
                "function": {"name": block.get("name", ""),
                             "arguments": json.dumps(block.get("input", {}))},
            })
    message: dict[str, Any] = {"role": "assistant", "content": "\n".join(text_parts) or None}
    if tool_calls:
        message["tool_calls"] = tool_calls
    return {"choices": [{"index": 0, "message": message,
                         "finish_reason": "tool_calls" if tool_calls else "stop"}],
            "usage": data.get("usage", {})}
