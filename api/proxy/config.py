from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name} must be an integer.") from exc


@dataclass(frozen=True)
class Settings:
    llama_base_url: str = os.getenv("LLAMA_BASE_URL", "http://127.0.0.1:8080").rstrip("/")
    proxy_host: str = os.getenv("PROXY_HOST", "127.0.0.1")
    proxy_port: int = _int_env("PROXY_PORT", 8001)
    api_keys_raw: str = os.getenv("API_KEYS", "")
    requests_per_minute: int = _int_env("REQUESTS_PER_MINUTE", 30)
    max_prompt_chars: int = _int_env("MAX_PROMPT_CHARS", 20000)
    max_tokens_per_request: int = _int_env("MAX_TOKENS_PER_REQUEST", 1024)
    request_timeout_seconds: int = _int_env("REQUEST_TIMEOUT_SECONDS", 120)
    allowed_model: str = os.getenv("ALLOWED_MODEL", "").strip()
    db_path: str = os.getenv("DB_PATH", "stackmind.db")
    history_context_messages: int = _int_env("HISTORY_CONTEXT_MESSAGES", 20)
    session_ttl_days: int = _int_env("SESSION_TTL_DAYS", 30)

    @property
    def api_keys(self) -> set[str]:
        return {key.strip() for key in self.api_keys_raw.split(",") if key.strip()}

    @property
    def session_ttl_seconds(self) -> int:
        return self.session_ttl_days * 86400


settings = Settings()
