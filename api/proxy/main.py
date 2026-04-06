import asyncio
import json
import sqlite3
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any, Optional

import aiosqlite
import httpx
from fastapi import Body, Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .config import settings
from .database import (
    create_session,
    create_user,
    delete_session,
    get_db_dep,
    get_history_for_display,
    get_recent_messages,
    get_summary,
    get_user_by_id,
    get_user_by_username,
    init_db,
    save_turn_background,
    _verify_password,
)
from .schemas import (
    AuthResponse,
    ChatCompletionsRequest,
    HistoryMessage,
    HistoryResponse,
    LoginRequest,
    Message,
    RegisterRequest,
)


# ── App setup ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Qwen Proxy API", version="0.2.0", lifespan=lifespan)
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


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


# ── Auth dependency ───────────────────────────────────────────────────────────

@dataclass
class AuthResult:
    token: str
    user_id: Optional[int]  # None when authenticated via static API key
    is_user_session: bool
    is_admin: bool


async def verify_api_key(
    authorization: str | None = Header(default=None),
    db: aiosqlite.Connection = Depends(get_db_dep),
) -> AuthResult:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.removeprefix("Bearer ").strip()

    # Path 1: static API key — treated as admin (configured in .env)
    if settings.api_keys and token in settings.api_keys:
        return AuthResult(token=token, user_id=None, is_user_session=False, is_admin=True)

    # Path 2: user session token
    from .database import get_session
    session = await get_session(db, token)
    if session:
        return AuthResult(
            token=token,
            user_id=session["user_id"],
            is_user_session=True,
            is_admin=bool(session["is_admin"]),
        )

    raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Payload validation ────────────────────────────────────────────────────────

def validate_request_payload(payload: ChatCompletionsRequest) -> None:
    if not payload.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")

    if payload.total_prompt_chars() > settings.max_prompt_chars:
        raise HTTPException(status_code=400, detail="Prompt exceeds MAX_PROMPT_CHARS")

    if payload.max_tokens and payload.max_tokens > settings.max_tokens_per_request:
        raise HTTPException(status_code=400, detail="max_tokens exceeds MAX_TOKENS_PER_REQUEST")

    if settings.allowed_model and payload.model and payload.model != settings.allowed_model:
        raise HTTPException(status_code=400, detail=f"Only model '{settings.allowed_model}' is allowed")


# ── Public endpoints ──────────────────────────────────────────────────────────

@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=AuthResponse)
async def register(
    payload: RegisterRequest = Body(...),
    db: aiosqlite.Connection = Depends(get_db_dep),
) -> AuthResponse:
    is_admin = payload.username in settings.admin_usernames
    try:
        user_id = await create_user(db, payload.username, payload.password, is_admin=is_admin)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Username already taken")
    token = await create_session(db, user_id)
    return AuthResponse(token=token, username=payload.username, user_id=user_id, is_admin=is_admin)


@app.post("/auth/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest = Body(...),
    db: aiosqlite.Connection = Depends(get_db_dep),
) -> AuthResponse:
    user = await get_user_by_username(db, payload.username)
    if not user or not _verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = await create_session(db, user["id"])
    return AuthResponse(
        token=token,
        username=user["username"],
        user_id=user["id"],
        is_admin=bool(user["is_admin"]),
    )


@app.post("/auth/logout")
async def logout(
    auth: AuthResult = Depends(verify_api_key),
    db: aiosqlite.Connection = Depends(get_db_dep),
) -> dict:
    if auth.is_user_session:
        await delete_session(db, auth.token)
    return {"ok": True}


# ── History endpoint ──────────────────────────────────────────────────────────

@app.get("/v1/history", response_model=HistoryResponse)
async def get_history(
    auth: AuthResult = Depends(verify_api_key),
    db: aiosqlite.Connection = Depends(get_db_dep),
) -> HistoryResponse:
    if not auth.is_user_session:
        raise HTTPException(status_code=403, detail="History requires a user session token")
    rows = await get_history_for_display(db, auth.user_id, limit=50)
    user = await get_user_by_id(db, auth.user_id)
    return HistoryResponse(
        messages=[HistoryMessage(**r) for r in rows],
        username=user["username"] if user else "",
    )


# ── Model list ────────────────────────────────────────────────────────────────

@app.get("/v1/models")
@limiter.limit(f"{settings.requests_per_minute}/minute")
async def list_models(request: Request, _: AuthResult = Depends(verify_api_key)) -> Any:
    timeout = httpx.Timeout(settings.request_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        upstream = await client.get(f"{settings.llama_base_url}/v1/models")
    return JSONResponse(status_code=upstream.status_code, content=upstream.json())


# ── Chat completions ──────────────────────────────────────────────────────────

@app.post("/v1/chat/completions")
@limiter.limit(f"{settings.requests_per_minute}/minute")
async def chat_completions(
    request: Request,
    payload: ChatCompletionsRequest = Body(...),
    auth: AuthResult = Depends(verify_api_key),
    db: aiosqlite.Connection = Depends(get_db_dep),
) -> Any:
    validate_request_payload(payload)

    # ── History context injection ─────────────────────────────────────────────
    user_content_for_save: str | None = None

    if auth.is_user_session:
        # Capture the latest user message before we mutate the payload
        user_msgs = [m for m in payload.messages if m.role == "user"]
        if user_msgs:
            user_content_for_save = user_msgs[-1].content

        history = await get_recent_messages(
            db, auth.user_id, limit=settings.history_context_messages
        )
        summary = await get_summary(db, auth.user_id)

        sys_msgs     = [m for m in payload.messages if m.role == "system"]
        non_sys_msgs = [m for m in payload.messages if m.role != "system"]
        history_msgs = [Message(role=r["role"], content=r["content"]) for r in history]

        # Prepend compressed summary of older messages as a system note
        summary_msgs: list[Message] = []
        if summary:
            summary_msgs = [Message(
                role="system",
                content=f"[Summary of earlier conversation]\n{summary['content']}",
            )]

        payload = payload.model_copy(
            update={"messages": sys_msgs + summary_msgs + history_msgs + non_sys_msgs}
        )

    url = f"{settings.llama_base_url}/v1/chat/completions"
    timeout = httpx.Timeout(settings.request_timeout_seconds)
    start = time.perf_counter()

    # ── Streaming path ────────────────────────────────────────────────────────
    if payload.stream:
        accumulated: list[str] = []
        _user_id = auth.user_id
        _user_content = user_content_for_save
        _is_user = auth.is_user_session

        async def streamer() -> Any:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST", url, json=payload.model_dump(exclude_none=True)
                ) as response:
                    if response.status_code >= 400:
                        detail = await response.aread()
                        raise HTTPException(
                            status_code=response.status_code,
                            detail=detail.decode("utf-8", errors="ignore"),
                        )
                    async for raw in response.aiter_bytes():
                        # Accumulate real content tokens for DB save
                        for line in raw.decode("utf-8", errors="ignore").split("\n"):
                            line = line.strip()
                            if not line.startswith("data: ") or line[6:] in ("[DONE]", ""):
                                continue
                            try:
                                delta = json.loads(line[6:])["choices"][0]["delta"]
                                token = delta.get("content") or ""
                                if token:
                                    accumulated.append(token)
                            except Exception:
                                pass
                        yield raw  # pass through immediately, no filtering

            # Stream finished — fire-and-forget DB save
            if _is_user and _user_content:
                assistant_text = "".join(accumulated)
                if assistant_text:
                    asyncio.create_task(
                        save_turn_background(
                            settings.db_path, _user_id, _user_content, assistant_text
                        )
                    )

        return StreamingResponse(
            streamer(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )

    # ── Non-streaming path ────────────────────────────────────────────────────
    async with httpx.AsyncClient(timeout=timeout) as client:
        upstream = await client.post(url, json=payload.model_dump(exclude_none=True))

    latency_ms = int((time.perf_counter() - start) * 1000)
    content = upstream.json()

    if auth.is_user_session and user_content_for_save and upstream.status_code < 400:
        assistant_text = (
            content.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        if assistant_text:
            asyncio.create_task(
                save_turn_background(
                    settings.db_path, auth.user_id, user_content_for_save, assistant_text
                )
            )

    if isinstance(content, dict):
        content.setdefault("proxy_metadata", {})
        if isinstance(content["proxy_metadata"], dict):
            content["proxy_metadata"]["latency_ms"] = latency_ms

    return JSONResponse(status_code=upstream.status_code, content=content)
