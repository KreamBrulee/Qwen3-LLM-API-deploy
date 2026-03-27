from __future__ import annotations

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
