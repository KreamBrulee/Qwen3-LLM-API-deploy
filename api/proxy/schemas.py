from typing import Any

from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str
    content: str


class ChatCompletionsRequest(BaseModel):
    model: str | None = None
    messages: list[Message] = Field(default_factory=list)
    max_tokens: int | None = None
    temperature: float | None = None
    stream: bool | None = False

    def total_prompt_chars(self) -> int:
        return sum(len(m.content) for m in self.messages)


class ErrorResponse(BaseModel):
    error: dict[str, Any]


# ── Auth schemas ──────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=40, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    token: str
    username: str
    user_id: int


class HistoryMessage(BaseModel):
    role: str
    content: str
    created_at: float


class HistoryResponse(BaseModel):
    messages: list[HistoryMessage]
    username: str
