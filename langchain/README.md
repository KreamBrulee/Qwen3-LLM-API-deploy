# LangChain + LangGraph — learning sandbox

Jupyter notebooks for learning LangChain and LangGraph against **your own**
llama.cpp server. Nothing here touches the production proxy in `api/proxy/`.

## Setup (one time)

```powershell
# From the project root, with the venv already created:
.venv\Scripts\python -m pip install -r requirements-langchain.txt
```

That installs LangChain, LangGraph, and `ipykernel` (the Jupyter kernel that
lets VS Code run these notebooks against this venv).

## Running a notebook

1. Start your llama.cpp server so it's live at `http://127.0.0.1:8080`
   (the same `LLAMA_BASE_URL` your proxy uses).
2. Open any `.ipynb` here in VS Code.
3. **Top-right kernel picker → choose the project `.venv`.** This is the step
   people miss: if the kernel isn't the venv, LangChain won't be importable.
4. Run cells top to bottom with `Shift+Enter`.

## The lessons, in order

| Notebook | Teaches | The proxy code it mirrors |
|----------|---------|----------------------------|
| `01_hello_model.ipynb` | A chat model object; `.invoke()` | `main.py:310-321` (httpx POST + JSON dig) |
| `02_prompt_and_chain.ipynb` | Prompt templates + the `\|` pipe (LCEL) | `database.py:259-283` (`_generate_summary`) |
| `03_streaming.ipynb` | `.stream()` token-by-token | `database.py:318-332` (SSE parsing) |
| `04_langgraph_basics.ipynb` | State, nodes, edges — a graph | `main.py:231-327` (`chat_completions`) |

Each notebook has the matching proxy snippet inline in a markdown cell, so you
can read "the old way" right above "the LangChain way."

## The core idea

Your proxy already **is** a conversation chain with memory, written by hand:

```
load history (database.py) -> inject context -> call llama.cpp (httpx) -> save turn
```

LangChain gives reusable blocks for the "call the model" and "format the
prompt" parts. LangGraph gives an explicit, inspectable **graph** for the
orchestration — and lets that flow **branch and loop** in a way a straight
chain can't.

## Mental model cheat-sheet

- **Runnable** — anything with `.invoke()` / `.stream()`. Models, prompts,
  parsers, and compiled graphs are all Runnables, which is why they compose.
- **LCEL** (`a | b | c`) — connect Runnables into a straight-line chain.
- **Chat model** (`ChatOpenAI`) — used because llama.cpp speaks the OpenAI
  `/v1/chat/completions` dialect; we just point it at localhost.
- **LangGraph State** — a shared dict flowing through the graph; nodes return
  partial updates merged in via "reducers" like `add_messages`.
- **Node** — a function `state -> dict`. **Edge** — wiring between nodes.

## Next up (not built yet)

- `05` — a **conditional edge**: let the model decide whether to call a tool,
  then loop back. The "agent" pattern and the real reason LangGraph exists.
- `06` — **persistent memory** with a LangGraph SQLite checkpointer, the
  principled version of your `save_turn_background` + history logic.
