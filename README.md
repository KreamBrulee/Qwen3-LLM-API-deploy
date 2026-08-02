# Local LLM Deployment + Internet API (Windows)

This repository gives you a performance-first implementation for running a local GGUF model (via llama.cpp) and exposing it over the internet safely, with user accounts, persistent chat history, and the StackMind web UI.

## Architecture
- `llama.cpp` (`llama-server`) hosts the model on `127.0.0.1:8080`
- `FastAPI` proxy on `127.0.0.1:8001` adds user auth, persistent history + rolling summaries, request limits, and payload guardrails
- `cloudflared` tunnel publishes your domain to the proxy without opening router ports
- `StackMind` frontend (`frontend-new-new-new/frontend-client/`) is the primary UI — open with `python -m http.server 5500` from that folder

## Model
The stack is model-agnostic: any GGUF that llama.cpp can serve works. Two models are referenced in the example configs:

- `qwen25-coder-3b-stackoverflow-q4_k_m` — custom Qwen 2.5 Coder 3B fine-tuned on Stack Overflow / programming data; this is what `deploy/deploy.settings.example.json` ships with and is the current deployment target
- `qwen3-14b-q4_k_m` — the original Qwen 3 14B setup, still the default in `.env.example` and the frontend model field

Whichever you serve, keep `ALLOWED_MODEL` in `.env`, the `model` field in requests, and the frontend model setting consistent.

## 1) Prerequisites
- Windows with NVIDIA GPU (12 GB VRAM for a 14B Q4_K_M; the 3B fine-tune runs in far less)
- CUDA-capable `llama-server.exe`
- A GGUF model file (recommended quant: `Q4_K_M`)
- Python 3.11+
- Cloudflare account + domain
- `cloudflared` installed

## 2) Create env and install dependencies
From the repository root:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` and set at minimum:
- `API_KEYS` — comma-separated static bearer tokens (act as admin; still work alongside user accounts)
- `ALLOWED_MODEL` — e.g. `qwen25-coder-3b-stackoverflow-q4_k_m`

Optional:
- `DB_PATH` (default `stackmind.db`)
- `HISTORY_CONTEXT_MESSAGES` (default `20`) — recent messages injected as context
- `SESSION_TTL_DAYS` (default `30`) — login session lifetime
- `SUMMARY_UPDATE_EVERY` (default `10`) — how often older history is compressed into a summary
- `ADMIN_USERNAMES` — comma-separated usernames that get admin on registration

## 3) Start llama.cpp server
```powershell
.\scripts\start-llama-server.ps1 `
  -ModelPath "E:\llm\models\qwen25-coder-3b-stackoverflow-q4_k_m.gguf" `
  -LlamaServerPath "E:\llm\bin\llama-server.exe"
```

Pass `-LlamaServerPath` explicitly to point at your `llama-server.exe` location.

## 4) Start secure proxy
In a second terminal, from the repository root:

```powershell
.\scripts\start-proxy.ps1
```

Local tests:

```powershell
$k = "<YOUR_API_KEY>"
$h = @{ Authorization = "Bearer $k" }
Invoke-RestMethod "http://127.0.0.1:8001/v1/models" -Headers $h
```

## 5) Cloudflare tunnel
1. Create tunnel and DNS route in Cloudflare Zero Trust.
2. Edit `cloudflare/config.yml` with real tunnel ID, user path, and hostname.
3. Run tunnel:

```powershell
.\scripts\start-cloudflared.ps1 -TunnelName "<your-tunnel-name>"
```

## 6) Public API usage
Use your domain endpoint:

```powershell
$k = "<YOUR_API_KEY>"
$h = @{ Authorization = "Bearer $k" }
$b = @{
  model = "qwen25-coder-3b-stackoverflow-q4_k_m"
  messages = @(@{ role = "user"; content = "Hello from internet endpoint" })
  max_tokens = 64
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Post -Uri "https://llm-api.example.com/v1/chat/completions" -Headers $h -Body $b -ContentType "application/json"
```

Streaming is supported: set `stream = $true` in the body and the proxy passes through server-sent events from llama.cpp.

## 7) Auto-start at boot (optional)
Use task registration script (PowerShell as Administrator), replacing `<repo>` with the repository path:

```powershell
.\deploy\windows\register-tasks.ps1 `
  -LlamaCommand "cd <repo>; .\scripts\start-llama-server.ps1 -ModelPath 'E:\llm\models\qwen25-coder-3b-stackoverflow-q4_k_m.gguf'" `
  -ProxyCommand "cd <repo>; .\scripts\start-proxy.ps1" `
  -TunnelCommand "cd <repo>; .\scripts\start-cloudflared.ps1 -TunnelName '<your-tunnel-name>'"
```

## User accounts

The proxy stores users, sessions, and conversation history in `stackmind.db` (SQLite, created automatically on first start).

**Register via the UI** — open StackMind in the browser, use the Sign In / Register overlay.

**Register via API** (PowerShell):
```powershell
$b = @{ username = "kunal"; password = "yourpassword" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8001/auth/register" -Body $b -ContentType "application/json"
```

The response includes a session `token` (use it as the Bearer token) and an `is_admin` flag. `POST /auth/login` and `POST /auth/logout` work the same way. Usernames listed in `ADMIN_USERNAMES` become admins at registration.

**List users in the DB**:
```powershell
.\.venv\Scripts\Activate.ps1
python -c "import sqlite3; [print(r) for r in sqlite3.connect('stackmind.db').execute('SELECT id,username FROM users')]"
```

**Delete a user**:
```powershell
python -c "import sqlite3; db=sqlite3.connect('stackmind.db'); db.execute('DELETE FROM users WHERE username=?',('username_here',)); db.commit()"
```

### History and summaries
When a user is logged in, their last `HISTORY_CONTEXT_MESSAGES` (default 20) messages are automatically injected as context into every request. Older messages beyond that window are periodically compressed (every `SUMMARY_UPDATE_EVERY` turns) into a rolling summary that is prepended as a system note, so long conversations keep context without unbounded prompt growth. `GET /v1/history` returns the recent history for the logged-in user.

## Security defaults in this implementation
- User account auth (register/login/logout) with session tokens stored in `stackmind.db`; sessions expire after `SESSION_TTL_DAYS`
- Static `API_KEYS` from `.env` still accepted and are treated as admin
- Servers bind to `127.0.0.1` only; the tunnel is the only public entry point
- CORS is open (`*`) on the proxy so the browser UI can call it from any origin — auth is enforced per-request, but keep this in mind if you tighten things later
- Prompt length (`MAX_PROMPT_CHARS`) and max tokens (`MAX_TOKENS_PER_REQUEST`) checks
- Request rate limiting (`REQUESTS_PER_MINUTE`)
- Request timeout bounds (`REQUEST_TIMEOUT_SECONDS`)
- Optional strict model pin via `ALLOWED_MODEL`

## Notes on performance
- For 12 GB VRAM, a 14B model at Q4_K_M fits; the 3B fine-tune leaves plenty of headroom.
- Keep context moderate (`-c 4096`) for latency stability.
- Increase throughput carefully by tuning `-b` and concurrency.

## Deployment framework (recommended)
Use the framework script to standardize future deployments.

### 1) Create deployment settings
```powershell
Copy-Item .\deploy\deploy.settings.example.json .\deploy\deploy.settings.json
```

Edit `deploy.settings.json` and set:
- `modelPath`
- `llamaServerPath`
- `tunnelName`
- `publicHostname`
- `allowedModel` (must match what you serve)

### 2) Initialize once
```powershell
.\scripts\deploy-framework.ps1 -Action init
```

### 3) Validate configuration
```powershell
.\scripts\deploy-framework.ps1 -Action validate
```

### 4) Start local stack (model + proxy)
```powershell
.\scripts\deploy-framework.ps1 -Action start-local
```

### 5) Start public stack (model + proxy + cloudflared)
```powershell
.\scripts\deploy-framework.ps1 -Action start-public
```

### 6) Run smoke checks
```powershell
.\scripts\deploy-framework.ps1 -Action smoke
```

### 7) Build deployment bundle for future rollout
```powershell
.\scripts\deploy-framework.ps1 -Action package
```

This creates a versioned zip in `out/` containing runtime scripts, API code, and deployment docs.

## API documentation

Detailed endpoint guide and request examples:

- [docs/api-reference.md](docs/api-reference.md)

Endpoints at a glance: `GET /healthz` (no auth), `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /v1/history`, `GET /v1/models`, `POST /v1/chat/completions` (streaming and non-streaming).

## Frontend (StackMind)

The primary UI is in `frontend-new-new-new/frontend-client/`. Serve it locally:

```powershell
cd frontend-new-new-new\frontend-client
python -m http.server 5500
```

Then open `http://localhost:5500` in your browser. Set the API Base URL to `http://127.0.0.1:8001` (or your Cloudflare domain) in the Admin or Config section.

Older UI iterations are kept for reference: `new-new-frontend-client/` and `new-frontend-client/`.
