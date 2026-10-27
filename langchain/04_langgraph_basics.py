"""
LESSON 4 — LangGraph: your proxy's logic as an explicit graph.

GOAL: Rebuild the heart of your proxy — "load history, call the model,
      save the turn" — as a LangGraph graph of nodes and edges. This is
      where LangGraph earns its place over plain LangChain.

RUN IT:
    .venv\\Scripts\\python langchain\\04_langgraph_basics.py

--------------------------------------------------------------------------
WHY A GRAPH AT ALL?

A LangChain chain (Lesson 2) is a straight line: A | B | C. Great when the
flow never branches. But your proxy does extra bookkeeping around the model
call — read history first, write the turn after — and real apps branch
("did the model ask for a tool? if so, loop"). A graph lets you express
that explicitly.

THE THREE PIECES OF ANY LANGGRAPH:

1. STATE — a shared dict that flows through the graph. Every node reads from
   it and returns updates to it. Think of it as the request's "working memory."
   Here our state holds the conversation `messages` (mirroring the history
   your proxy pulls from SQLite).

2. NODES — plain Python functions. Each takes the state, does one job, and
   returns a dict of fields to merge back into the state.

3. EDGES — the wiring that says which node runs after which. A normal edge is
   "always go A -> B". (Lesson 5 will add a *conditional* edge that branches.)

We use an in-memory dict as a stand-in for your SQLite history so this script
runs on its own. The shape of the logic is the same as your proxy.
--------------------------------------------------------------------------
"""

from typing import Annotated, TypedDict

from langchain_openai import ChatOpenAI
from langchain_core.messages import AnyMessage, HumanMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

# ── A fake "database" so this lesson is self-contained ──────────────────────
# In your real app this is SQLite (api/proxy/database.py). Here it's just a
# module-level list we read at the start and append to at the end.
FAKE_HISTORY: list[dict] = []


# ── 1. THE STATE ────────────────────────────────────────────────────────────
# A TypedDict describes what fields the state carries. The `Annotated[...,
# add_messages]` part is a LangGraph trick: it tells the graph that when a
# node returns new `messages`, they should be APPENDED to the existing list
# (not overwrite it). `add_messages` is the built-in "reducer" for that.
class ChatState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]


model = ChatOpenAI(
    base_url="http://127.0.0.1:8080/v1",
    api_key="not-needed",
    model="qwen3-14b-q4_k_m",
    temperature=0.7,
)


# ── 2. THE NODES ────────────────────────────────────────────────────────────
# Node A: load prior history and prepend it to the state's messages.
# Mirrors get_recent_messages() in your proxy.
def load_history(state: ChatState) -> dict:
    prior = [HumanMessage(content=h["content"]) if h["role"] == "user"
             else ("ai", h["content"]) for h in FAKE_HISTORY]
    print(f"[load_history] pulled {len(prior)} prior message(s) from 'db'")
    # Returning messages with the add_messages reducer PREPENDS logically by
    # merging; order is preserved as appended. For a demo this is enough.
    return {"messages": prior}


# Node B: call the model on whatever messages are in state.
# Mirrors the httpx.post to llama.cpp in your proxy.
def call_model(state: ChatState) -> dict:
    print(f"[call_model] sending {len(state['messages'])} message(s) to the model")
    reply = model.invoke(state["messages"])
    return {"messages": [reply]}  # appended to state via the reducer


# Node C: persist the latest exchange. Mirrors save_turn_background().
def save_turn(state: ChatState) -> dict:
    last_user = next(
        (m for m in reversed(state["messages"]) if m.type == "human"), None
    )
    last_ai = state["messages"][-1]
    if last_user:
        FAKE_HISTORY.append({"role": "user", "content": last_user.content})
    FAKE_HISTORY.append({"role": "assistant", "content": last_ai.content})
    print(f"[save_turn] saved turn; 'db' now has {len(FAKE_HISTORY)} rows")
    return {}  # no state change needed


# ── 3. WIRE THE GRAPH ───────────────────────────────────────────────────────
builder = StateGraph(ChatState)

builder.add_node("load_history", load_history)
builder.add_node("call_model", call_model)
builder.add_node("save_turn", save_turn)

# START and END are special built-in markers for "entry" and "exit".
builder.add_edge(START, "load_history")      # begin here
builder.add_edge("load_history", "call_model")
builder.add_edge("call_model", "save_turn")
builder.add_edge("save_turn", END)           # finish here

# .compile() turns the blueprint into a runnable graph — and a compiled graph
# is itself a Runnable, so it has .invoke() and .stream() just like a chain.
graph = builder.compile()


# ── RUN IT TWICE to see memory accumulate across "requests" ─────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("FIRST request (history is empty):")
    out = graph.invoke({"messages": [HumanMessage(content="My name is Kunal.")]})
    print("\nMODEL SAID:", out["messages"][-1].content)

    print("\n" + "=" * 60)
    print("SECOND request (history now has the first turn):")
    out = graph.invoke({"messages": [HumanMessage(content="What's my name?")]})
    print("\nMODEL SAID:", out["messages"][-1].content)
    print("=" * 60)

    # You can also print the graph structure as ASCII:
    print("\nGraph shape:")
    print(graph.get_graph().draw_ascii())
