"""
LESSON 1 — Talking to your model through LangChain.

GOAL: Send one message to your local llama.cpp server and print the reply,
      but using LangChain's model object instead of raw httpx.

RUN IT:
    # 1. Make sure your llama.cpp server is running at http://127.0.0.1:8080
    # 2. From the project root:
    .venv\\Scripts\\python langchain\\01_hello_model.py

--------------------------------------------------------------------------
THE ONE CONCEPT IN THIS LESSON: the "chat model" object.

In your proxy (api/proxy/main.py) you build a URL, build a JSON body,
call httpx, and dig the text back out of the JSON. LangChain wraps all of
that in a single object called a *chat model*. You hand it messages, it
hands you back a message. That's it.

We use `ChatOpenAI` NOT because we're calling OpenAI, but because your
llama.cpp server speaks the OpenAI API dialect (same /v1/chat/completions
shape your proxy forwards to). So any OpenAI-compatible client can talk to
it — we just point it at your local URL.
--------------------------------------------------------------------------
"""

from langchain_openai import ChatOpenAI

# ── Build the chat model ───────────────────────────────────────────────────
# Each argument maps to something you already deal with in your proxy:
model = ChatOpenAI(
    base_url="http://127.0.0.1:8080/v1",  # your LLAMA_BASE_URL + /v1
    api_key="not-needed",                 # llama.cpp ignores this, but the
                                          # client library requires *some* value
    model="qwen3-14b-q4_k_m",             # your ALLOWED_MODEL from .env
    temperature=0.7,                      # same knob you'd pass in the JSON body
)

# ── Ask it something ────────────────────────────────────────────────────────
# `invoke` = "run this once, give me the result." We pass a list of messages.
# Each message is a (role, content) tuple — exactly the role/content pairs
# your Message schema uses, just written as Python tuples here.
response = model.invoke(
    [
        ("system", "You are a terse assistant. Answer in one sentence."),
        ("human", "What is a FastAPI dependency, in plain words?"),
    ]
)

# `response` is an AIMessage object (LangChain's wrapper around the reply).
# The text lives in `.content`.
print("=" * 60)
print("REPLY:\n")
print(response.content)
print("=" * 60)

# Everything else the model returned (token counts, finish reason, etc.)
# is tucked into response.response_metadata — uncomment to peek:
# print(response.response_metadata)
