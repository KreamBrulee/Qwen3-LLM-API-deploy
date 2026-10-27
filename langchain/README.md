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

> **If `ipykernel` fails to install** (slow/flaky PyPI connection — it was
> timing out when this was set up), the notebooks are still fine. Either let
> VS Code's Python/Jupyter extension supply a kernel, or install it on its own
> once your network is cooperating:
> ```powershell
> .venv\Scripts\python -m pip install ipykernel --timeout 120 --retries 10
> ```

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
| `05_agent_tool_loop.ipynb` | Conditional edges; the agent/tool loop | (proxy has no tool loop — this is new ground) |
| `06_persistent_memory.ipynb` | Checkpointers; `thread_id`; durable state | `database.py` save/load + `stackmind.db` |

Each notebook has the matching proxy snippet inline in a markdown cell, so you
can read "the old way" right above "the LangChain way."

> **Lesson 6's last cell** (durable SQLite memory) needs one extra package:
> `.venv\Scripts\python -m pip install langgraph-checkpoint-sqlite`
> Everything else in 05 and 06 runs with what's already installed. The cell
> catches the missing package and prints this command, so the notebook won't
> crash if you skip it.

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

## Where to go after the six lessons

You've covered the core. Good things to build yourself next:

- Add a **summary node** to the Lesson 6 graph that compresses old turns —
  LangGraph's version of your `_generate_summary` rolling summary.
- Turn Lesson 5's agent into a real tool over your own data (e.g. a tool that
  queries `stackmind.db`).
- Compare `create_react_agent` (LangGraph's prebuilt agent) against the
  hand-wired loop in Lesson 5 to see what the one-liner hides.
