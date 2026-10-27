"""
v2 — the LangChain pipeline (basic version).

This file holds ONE thing: a minimal LangChain chain that takes a user's
message and returns the model's reply. No history, no streaming, no auth —
those come later. The goal is a pipeline you can read top to bottom.

The pipeline is the Lesson 2 structure:

    prompt | model | parser

Read left to right like a Unix pipe:
  1. prompt  — turn the incoming text into a chat prompt
  2. model   — send that prompt to your llama.cpp server, get a reply
  3. parser  — pull the plain-text string out of the reply
"""

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from .config import settings


# ── 1. The model ────────────────────────────────────────────────────────────
# ChatOpenAI speaks the OpenAI /v1/chat/completions dialect. Your llama.cpp
# server speaks the same dialect, so we just point it at your local server
# instead of at OpenAI. The values come from your existing .env via settings.
model = ChatOpenAI(
    base_url=f"{settings.llama_base_url}/v1",   # e.g. http://127.0.0.1:8080/v1
    api_key="not-needed",                       # llama.cpp ignores it; the client requires some value
    model=settings.allowed_model or "qwen3-14b-q4_k_m",
    temperature=0.7,
)


# ── 2. The prompt ─────────────────────────────────────────────────────────────
# A template with one blank, {user_message}, that we fill at call time.
prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "You are a helpful assistant."),
        ("human", "{user_message}"),
    ]
)


# ── 3. The parser ─────────────────────────────────────────────────────────────
# The model returns an AIMessage object; StrOutputParser pulls out its .content
# so the chain's final output is a plain string.
parser = StrOutputParser()


# ── The chain ─────────────────────────────────────────────────────────────────
# Snap the three pieces together. `chain` is now one callable object.
chain = prompt | model | parser


async def run_pipeline(user_message: str) -> str:
    """Run the chain once and return the reply text.

    `ainvoke` is the async version of `invoke` — we use it because FastAPI
    routes are async, so this won't block the server while the model thinks.
    """
    return await chain.ainvoke({"user_message": user_message})
