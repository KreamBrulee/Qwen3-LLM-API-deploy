# Operations Playbook

## Health checks
- Local proxy: `http://127.0.0.1:8001/healthz`
- Public endpoint: `https://<your-domain>/healthz`

## Smoke tests
```powershell
$apiKey = "<YOUR_API_KEY>"
$headers = @{ Authorization = "Bearer $apiKey" }

Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8001/v1/models" -Headers $headers

$body = @{
  model = "qwen3-14b-q4_k_m"
  messages = @(
    @{ role = "system"; content = "You are a concise assistant." },
    @{ role = "user"; content = "Reply with: service online" }
  )
  max_tokens = 32
} | ConvertTo-Json -Depth 8

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8001/v1/chat/completions" -Headers $headers -Body $body -ContentType "application/json"
```

## Rate-limit tuning
- Start with `REQUESTS_PER_MINUTE=30`.
- Increase only after observing p95 latency under expected concurrent load.

## Incident checklist
1. Verify llama server is reachable at `127.0.0.1:8080`.
2. Verify proxy log shows no upstream timeout.
3. Verify cloudflared tunnel status.
4. Rotate leaked API key and restart proxy.
