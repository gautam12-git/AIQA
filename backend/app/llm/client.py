"""Provider-agnostic LLM client with fallback.

AIQA talks to one interface (`get_llm().chat(...)`). Behind it sits an ordered
list of OpenAI-compatible providers; `chat()` tries each until one succeeds, so
a single provider being rate-limited, out of credits, or down never takes the
AI layer offline.

Providers configured today:
  - nvidia : NVIDIA NIM (integrate.api.nvidia.com), bearer auth.
  - glm    : GLM 5.3 Flash behind a Modal endpoint, Modal-Key/Secret auth
             (or bearer if a plain key is set).

Order is controlled by LLM_ORDER (default "nvidia,glm").
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
                    resp = await http.post(f"{p.base_url.rstrip('/')}/chat/completions",
                                           headers=p.headers(), json=payload)
                    resp.raise_for_status()
                    data = resp.json()
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
