"""Runtime configuration, read from environment / .env.

Secrets (GLM key, Modal tokens, DB URL) come from the environment or a
gitignored .env — never hardcoded, never committed. On Modal they come
from a Modal Secret mounted as env vars.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Absolute path to backend/.env so config loads regardless of the process cwd
# (lets uvicorn run via `--app-dir` from the repo root or from backend/).
_ENV_FILE = str(Path(__file__).resolve().parent.parent / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    # --- App ---
    app_name: str = "AIQA API"
    version: str = "0.1.0"
    cors_origins: list[str] = Field(default=["http://localhost:3000"])
    # Seed demo/mock data into an EMPTY database. Off for a real instance.
    seed_demo: bool = Field(default=False, validation_alias="SEED_DEMO")

    # --- LLM (provider-agnostic; GLM by default, OpenAI-compatible) ---
    # Fill GLM_API_KEY + confirm the exact model id / base URL from your
    # provider dashboard. base_url points at an OpenAI-compatible endpoint.
    llm_provider: str = "glm"
    glm_api_key: str = Field(default="", validation_alias="GLM_API_KEY")
    glm_base_url: str = Field(
        default="https://open.bigmodel.cn/api/paas/v4",
        validation_alias="GLM_BASE_URL",
    )
    glm_model: str = Field(default="glm-4-flash", validation_alias="GLM_MODEL")

    # Auth scheme for GLM: "bearer" (standard) or "modal" (Modal-Key/Modal-Secret
    # headers, for a GLM model served behind a Modal *.run web endpoint).
    llm_auth_mode: str = Field(default="bearer", validation_alias="LLM_AUTH_MODE")
    modal_key: str = Field(default="", validation_alias="MODAL_KEY")
    modal_secret: str = Field(default="", validation_alias="MODAL_SECRET")

    # NVIDIA NIM (OpenAI-compatible, bearer). Used as a provider in the
    # fallback chain alongside GLM so the AI layer survives one being down.
    nvidia_api_key: str = Field(default="", validation_alias="NVIDIA_API_KEY")
    nvidia_base_url: str = Field(
        default="https://integrate.api.nvidia.com/v1", validation_alias="NVIDIA_BASE_URL")
    nvidia_model: str = Field(default="mistralai/mistral-nemotron", validation_alias="NVIDIA_MODEL")

    # Vision model (multimodal) for visual UI-bug detection on screenshots.
    nvidia_vision_key: str = Field(default="", validation_alias="NVIDIA_VISION_KEY")
    nvidia_vision_model: str = Field(default="moonshotai/kimi-k3", validation_alias="NVIDIA_VISION_MODEL")

    # Order to try providers, comma-separated: "nvidia,glm".
    llm_order: str = Field(default="nvidia,glm", validation_alias="LLM_ORDER")
    llm_max_tokens: int = Field(default=4096, validation_alias="LLM_MAX_TOKENS")

    # --- Persistence: MySQL (database "aiqa" on localhost) ---
    # Credentials come from env only. If DATABASE_URL is set explicitly it
    # wins; otherwise it's assembled from the parts below.
    database_url: str = Field(default="", validation_alias="DATABASE_URL")
    mysql_host: str = Field(default="localhost", validation_alias="MYSQL_HOST")
    mysql_port: int = Field(default=3306, validation_alias="MYSQL_PORT")
    mysql_db: str = Field(default="aiqa", validation_alias="MYSQL_DB")
    mysql_user: str = Field(default="root", validation_alias="MYSQL_USER")
    mysql_password: str = Field(default="", validation_alias="MYSQL_PASSWORD")

    # --- Storage for evidence (screenshots/DOM/traces) ---
    evidence_bucket: str = Field(default="", validation_alias="EVIDENCE_BUCKET")

    # --- Product auth (user login / OTP email verification) ---
    jwt_secret: str = Field(default="dev-insecure-change-me", validation_alias="JWT_SECRET")
    jwt_expiry_hours: int = Field(default=168, validation_alias="JWT_EXPIRY_HOURS")  # 7 days
    # Email via Brevo HTTP API (same provider as smart-expense).
    brevo_api_key: str = Field(default="", validation_alias="BREVO_API_KEY")
    brevo_from: str = Field(default="AIQA <no-reply@aiqa.dev>", validation_alias="BREVO_FROM")

    @property
    def sqlalchemy_url(self) -> str:
        """Async SQLAlchemy URL for MySQL (aiomysql driver)."""
        if self.database_url:
            return self.database_url
        pw = quote_plus(self.mysql_password)
        return (
            f"mysql+aiomysql://{self.mysql_user}:{pw}"
            f"@{self.mysql_host}:{self.mysql_port}/{self.mysql_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
