# Local Qwen 3 14B Deployment + Internet API (Windows)

This repository gives you a performance-first implementation for running Qwen 3 14B locally and exposing it over the internet safely.

## Architecture
- `llama.cpp` (`llama-server`) hosts the model on `127.0.0.1:8080`
- `FastAPI` proxy on `127.0.0.1:8001` adds auth, request limits, and payload guardrails
- `cloudflared` tunnel publishes your domain to the proxy without opening router ports

## 1) Prerequisites
- Windows with NVIDIA GPU (12 GB VRAM)
- CUDA-capable `llama-server.exe`
- Qwen 3 14B GGUF model (recommended quant: `Q4_K_M`)
- Python 3.11+
- Cloudflare account + domain
- `cloudflared` installed

## 2) Create env and install dependencies
```powershell
cd e:\Kunal\VS_shit\LLM-deploy
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` and set at minimum:
- `API_KEYS`
- `ALLOWED_MODEL`
- Optional limits and timeout values

## 3) Start llama.cpp server
Put `llama-server.exe` in `./bin` and run:

```powershell
.\scripts\start-llama-server.ps1 -ModelPath "E:\models\qwen3-14b-q4_k_m.gguf"
```

## 4) Start secure proxy
In a second terminal:

```powershell
cd e:\Kunal\VS_shit\LLM-deploy
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
  model = "qwen3-14b-q4_k_m"
  messages = @(@{ role = "user"; content = "Hello from internet endpoint" })
  max_tokens = 64
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Post -Uri "https://llm-api.example.com/v1/chat/completions" -Headers $h -Body $b -ContentType "application/json"
```

## 7) Auto-start at boot (optional)
Use task registration script (PowerShell as Administrator):

```powershell
.\deploy\windows\register-tasks.ps1 `
  -LlamaCommand "cd e:\Kunal\VS_shit\LLM-deploy; .\scripts\start-llama-server.ps1 -ModelPath 'E:\models\qwen3-14b-q4_k_m.gguf'" `
  -ProxyCommand "cd e:\Kunal\VS_shit\LLM-deploy; .\scripts\start-proxy.ps1" `
  -TunnelCommand "cd e:\Kunal\VS_shit\LLM-deploy; .\scripts\start-cloudflared.ps1 -TunnelName '<your-tunnel-name>'"
```

## Security defaults in this implementation
- Bearer token auth required (`API_KEYS`)
- Local bind only (`127.0.0.1`)
- Prompt length and max tokens checks
- Request rate limiting
- Request timeout bounds

## Notes on performance
- For 12 GB VRAM, start with Q4_K_M.
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

## Simple frontend client

Isolated browser UI that calls your domain API:

- [frontend-client/README.md](frontend-client/README.md)
