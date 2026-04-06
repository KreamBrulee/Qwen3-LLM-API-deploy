import hashlib
import hmac
import json
import secrets
import time
from typing import AsyncGenerator, Optional

import aiosqlite
import httpx

from .config import settings


# ── Schema ────────────────────────────────────────────────────────────────────

_DDL = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    is_admin      INTEGER NOT NULL DEFAULT 0,
    created_at    REAL    NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at REAL    NOT NULL,
    expires_at REAL    NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       TEXT    NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content    TEXT    NOT NULL,
    created_at REAL    NOT NULL
);

CREATE TABLE IF NOT EXISTS summaries (
    user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    content        TEXT    NOT NULL,
    covered_count  INTEGER NOT NULL,
    updated_at     REAL    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_user_time
    ON messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_token
    ON sessions(token);
"""


async def init_db() -> None:
    async with aiosqlite.connect(settings.db_path) as db:
        await db.executescript(_DDL)
        # Migration: add is_admin column to existing databases
        try:
            await db.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
            await db.commit()
        except Exception:
            pass  # Column already exists


# ── Per-request dependency ────────────────────────────────────────────────────

async def get_db_dep() -> AsyncGenerator[aiosqlite.Connection, None]:
    async with aiosqlite.connect(settings.db_path) as db:
        db.row_factory = aiosqlite.Row
        yield db


# ── Password helpers ──────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    """Return 'salt_hex:digest_hex' using sha256 + 16-byte random salt."""
    salt = secrets.token_bytes(16)
    digest = hashlib.sha256(salt + password.encode()).hexdigest()
    return f"{salt.hex()}:{digest}"


def _verify_password(password: str, stored: str) -> bool:
    """Constant-time comparison to resist timing attacks."""
    try:
        salt_hex, digest_hex = stored.split(":", 1)
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    candidate = hashlib.sha256(salt + password.encode()).hexdigest()
    return hmac.compare_digest(candidate, digest_hex)


# ── User CRUD ─────────────────────────────────────────────────────────────────

async def create_user(
    db: aiosqlite.Connection, username: str, password: str, is_admin: bool = False
) -> int:
    """Insert a new user. Raises sqlite3.IntegrityError if username is taken."""
    password_hash = _hash_password(password)
    cursor = await db.execute(
        "INSERT INTO users (username, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?)",
        (username, password_hash, int(is_admin), time.time()),
    )
    await db.commit()
    return cursor.lastrowid


async def get_user_by_username(db: aiosqlite.Connection, username: str) -> Optional[dict]:
    async with db.execute(
        "SELECT id, username, password_hash, is_admin FROM users WHERE username = ?", (username,)
    ) as cursor:
        row = await cursor.fetchone()
    return dict(row) if row else None


async def get_user_by_id(db: aiosqlite.Connection, user_id: int) -> Optional[dict]:
    async with db.execute(
        "SELECT id, username, is_admin FROM users WHERE id = ?", (user_id,)
    ) as cursor:
        row = await cursor.fetchone()
    return dict(row) if row else None


# ── Session CRUD ──────────────────────────────────────────────────────────────

async def create_session(db: aiosqlite.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = time.time()
    await db.execute(
        "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (token, user_id, now, now + settings.session_ttl_seconds),
    )
    await db.commit()
    return token


async def get_session(db: aiosqlite.Connection, token: str) -> Optional[dict]:
    async with db.execute(
        """
        SELECT s.token, s.user_id, s.expires_at, u.is_admin
        FROM sessions s JOIN users u ON s.user_id = u.id
        WHERE s.token = ?
        """,
        (token,),
    ) as cursor:
        row = await cursor.fetchone()
    if not row:
        return None
    session = dict(row)
    if session["expires_at"] < time.time():
        return None
    return session


async def delete_session(db: aiosqlite.Connection, token: str) -> None:
    await db.execute("DELETE FROM sessions WHERE token = ?", (token,))
    await db.commit()


# ── Message CRUD ──────────────────────────────────────────────────────────────

async def save_message_pair(
    db: aiosqlite.Connection,
    user_id: int,
    user_content: str,
    assistant_content: str,
) -> None:
    now = time.time()
    await db.executemany(
        "INSERT INTO messages (user_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        [
            (user_id, "user", user_content, now),
            (user_id, "assistant", assistant_content, now + 0.001),
        ],
    )
    await db.commit()


async def get_recent_messages(
    db: aiosqlite.Connection, user_id: int, limit: int
) -> list[dict]:
    """Return up to `limit` recent messages in chronological order (oldest first)."""
    async with db.execute(
        """
        SELECT role, content FROM (
            SELECT role, content, created_at
            FROM messages WHERE user_id = ?
            ORDER BY created_at DESC LIMIT ?
        ) ORDER BY created_at ASC
        """,
        (user_id, limit),
    ) as cursor:
        rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def get_history_for_display(
    db: aiosqlite.Connection, user_id: int, limit: int = 50
) -> list[dict]:
    """Return up to `limit` messages newest-first for the /v1/history endpoint."""
    async with db.execute(
        "SELECT role, content, created_at FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        (user_id, limit),
    ) as cursor:
        rows = await cursor.fetchall()
    return [dict(r) for r in rows]


# ── Summary CRUD ──────────────────────────────────────────────────────────────

async def get_summary(db: aiosqlite.Connection, user_id: int) -> Optional[dict]:
    """Return {content, covered_count} or None."""
    async with db.execute(
        "SELECT content, covered_count FROM summaries WHERE user_id = ?", (user_id,)
    ) as cursor:
        row = await cursor.fetchone()
    return dict(row) if row else None


async def upsert_summary(
    db: aiosqlite.Connection, user_id: int, content: str, covered_count: int
) -> None:
    await db.execute(
        """
        INSERT INTO summaries (user_id, content, covered_count, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            content       = excluded.content,
            covered_count = excluded.covered_count,
            updated_at    = excluded.updated_at
        """,
        (user_id, content, covered_count, time.time()),
    )
    await db.commit()


async def _get_oldest_n_messages(
    db: aiosqlite.Connection, user_id: int, n: int
) -> list[dict]:
    """Return the chronologically first `n` messages for this user."""
    async with db.execute(
        "SELECT role, content FROM messages WHERE user_id = ? ORDER BY created_at ASC LIMIT ?",
        (user_id, n),
    ) as cursor:
        rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def _get_total_message_count(db: aiosqlite.Connection, user_id: int) -> int:
    async with db.execute(
        "SELECT COUNT(*) FROM messages WHERE user_id = ?", (user_id,)
    ) as cursor:
        return (await cursor.fetchone())[0]


async def _generate_summary(messages: list[dict]) -> str:
    """Call the LLM to compress a list of messages into a paragraph summary."""
    conv_text = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in messages
    )
    prompt = (
        "Summarize the following conversation history into a concise paragraph. "
        "Capture key topics, facts, decisions, and any personal details the user shared. "
        "Write in third person (e.g. 'The user asked about...', 'The assistant explained...'). "
        "Be specific — this summary will be the only record of these earlier messages.\n\n"
        f"{conv_text}\n\nSUMMARY:"
    )
    payload = {
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 512,
        "temperature": 0.3,
        "stream": False,
    }
    if settings.allowed_model:
        payload["model"] = settings.allowed_model

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            resp = await client.post(
                f"{settings.llama_base_url}/v1/chat/completions", json=payload
            )
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return ""


# ── Streaming background save + summarization ─────────────────────────────────

async def save_turn_background(
    db_path: str, user_id: int, user_content: str, assistant_content: str
) -> None:
    """Save a turn then conditionally regenerate the rolling summary."""
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        await save_message_pair(db, user_id, user_content, assistant_content)

        total = await _get_total_message_count(db, user_id)
        n = settings.history_context_messages
        old_count = total - n          # messages that fall outside the live window

        if old_count <= 0:
            return

        existing = await get_summary(db, user_id)
        covered  = existing["covered_count"] if existing else 0

        # Regenerate when enough new messages have accumulated outside the live window
        if (old_count - covered) >= settings.summary_update_every:
            msgs_to_summarise = await _get_oldest_n_messages(db, user_id, old_count)
            summary_text = await _generate_summary(msgs_to_summarise)
            if summary_text:
                await upsert_summary(db, user_id, summary_text, old_count)


# ── SSE token extraction (sync helper used inside streamer) ───────────────────

def extract_tokens_from_chunk(chunk: bytes, acc: list) -> None:
    """Parse raw SSE bytes and append delta content tokens to acc."""
    for line in chunk.decode("utf-8", errors="ignore").split("\n"):
        line = line.strip()
        if not line.startswith("data: "):
            continue
        data = line[6:]
        if data == "[DONE]":
            return
        try:
            token = json.loads(data)["choices"][0]["delta"].get("content", "")
            if token:
                acc.append(token)
        except Exception:
            pass
