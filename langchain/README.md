# LangChain + LangGraph — learning sandbox

Standalone scripts for learning LangChain and LangGraph against **your own**
llama.cpp server. Nothing here touches the production proxy in `api/proxy/`.

## Setup (one time)

```powershell
# From the project root, with the venv already created:
.venv\Scripts\python -m pip install -r requirements-langchain.txt
```

## Before running any lesson

Your llama.cpp server must be running at `http://127.0.0.1:8080` (the same
`LLAMA_BASE_URL` your proxy uses). Start it the usual way, then:

```powershell
.venv\Scripts\python langchain\01_hello_model.py
```

## The lessons, in order

| File | Teaches | Maps to this part of your proxy |
|------|---------|----------------------------------|
| `01_hello_model.py` | A chat model object; `.invoke()` | the `httpx.post` + JSON digging in `main.py` |
| `02_prompt_and_chain.py` | Prompt templates + the `\|` pipe (LCEL) | prompt building / message assembly |
| `03_streaming.py` | `.stream()` token-by-token | the `streamer()` generator in `main.py` |
| `04_langgraph_basics.py` | State, nodes, edges — a graph | load history → call model → save turn |

## The core idea

Your proxy already **is** a conversation chain with memory, written by hand:

```
load history (database.py) → inject context → call llama.cpp (httpx) → save turn
```

LangChain gives you reusable building blocks for the "call the model" and
"format the prompt" parts. LangGraph gives you an explicit, inspectable
**graph** for the orchestration — the load/call/save flow — and, importantly,
lets that flow **branch and loop** (see the next lessons) in a way a straight
chain can't.

## Mental model cheat-sheet

- **Runnable** — anything with `.invoke()` / `.stream()`. Models, prompts,
  parsers, and compiled graphs are all Runnables, which is why they compose.
- **LCEL** (`a | b | c`) — connect Runnables into a straight-line chain.
- **Chat model** (`ChatOpenAI`) — we use the OpenAI client because llama.cpp
  speaks the OpenAI `/v1/chat/completions` dialect; we just point it local.
- **LangGraph State** — a shared dict flowing through the graph; nodes return
  partial updates that get merged in (via "reducers" like `add_messages`).
- **Node** — a plain function `state -> dict`. **Edge** — wiring between nodes.

## Next up (not built yet)

- `05` — a **conditional edge**: let the model decide whether to call a tool,
  then loop back. This is the "agent" pattern and the real reason LangGraph
  exists.
- `06` — **persistent memory** with a LangGraph checkpointer backed by SQLite,
  which is the principled version of your `save_turn_background` + history.
