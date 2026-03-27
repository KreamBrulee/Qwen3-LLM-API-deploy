from __future__ import annotations

import time
from typing import Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .config import settings
from .schemas import ChatCompletionsRequest


limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Qwen Proxy API", version="0.1.0")
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(_: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "error": {
                "message": "Too many requests",
                "type": "rate_limit_error",
                "code": "rate_limit_exceeded",
                "detail": str(exc),
            }
        },
    )


def verify_api_key(authorization: str | None = Header(default=None)) -> str:
    if not settings.api_keys:
        raise HTTPException(status_code=500, detail="API_KEYS is not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.removeprefix("Bearer ").strip()
    if token not in settings.api_keys:
        raise HTTPException(status_code=401, detail="Invalid bearer token")
    return token


def validate_request_payload(payload: ChatCompletionsRequest) -> None:
    if not payload.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")

    if payload.total_prompt_chars() > settings.max_prompt_chars:
        raise HTTPException(status_code=400, detail="Prompt exceeds MAX_PROMPT_CHARS")

    if payload.max_tokens and payload.max_tokens > settings.max_tokens_per_request:
        raise HTTPException(status_code=400, detail="max_tokens exceeds MAX_TOKENS_PER_REQUEST")

    if settings.allowed_model and payload.model and payload.model != settings.allowed_model:
        raise HTTPException(status_code=400, detail=f"Only model '{settings.allowed_model}' is allowed")


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/models")
@limiter.limit(lambda: f"{settings.requests_per_minute}/minute")
async def list_models(request: Request, _: str = Depends(verify_api_key)) -> Any:
    timeout = httpx.Timeout(settings.request_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        upstream = await client.get(f"{settings.llama_base_url}/v1/models")
    return JSONResponse(status_code=upstream.status_code, content=upstream.json())


@app.post("/v1/chat/completions")
@limiter.limit(lambda: f"{settings.requests_per_minute}/minute")
async def chat_completions(
    request: Request,
    payload: ChatCompletionsRequest,
    _: str = Depends(verify_api_key),
) -> Any:
    validate_request_payload(payload)
    url = f"{settings.llama_base_url}/v1/chat/completions"
    timeout = httpx.Timeout(settings.request_timeout_seconds)

    start = time.perf_counter()

    if payload.stream:
        async def streamer() -> Any:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("POST", url, json=payload.model_dump(exclude_none=True)) as response:
                    if response.status_code >= 400:
                        detail = await response.aread()
                        raise HTTPException(status_code=response.status_code, detail=detail.decode("utf-8", errors="ignore"))
                    async for chunk in response.aiter_bytes():
                        yield chunk

        return StreamingResponse(streamer(), media_type="text/event-stream")

    async with httpx.AsyncClient(timeout=timeout) as client:
        upstream = await client.post(url, json=payload.model_dump(exclude_none=True))

    latency_ms = int((time.perf_counter() - start) * 1000)
    content = upstream.json()
    if isinstance(content, dict):
        content.setdefault("proxy_metadata", {})
        if isinstance(content["proxy_metadata"], dict):
            content["proxy_metadata"]["latency_ms"] = latency_ms

    return JSONResponse(status_code=upstream.status_code, content=content)
