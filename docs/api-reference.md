# API Reference

This document explains what your proxy API can do and how to call it.

## Base URLs

- Local: http://127.0.0.1:8001
- Public (through Cloudflare tunnel): https://your-domain

Use the same routes for local and public access.

## Authentication

All model routes require a Bearer token.

- Required header: Authorization: Bearer YOUR_API_KEY
- API keys are read from API_KEYS in .env (comma-separated list)

If auth is missing or wrong:

- 401 Missing bearer token
- 401 Invalid bearer token

## What This API Can Do

1. Health check endpoint
- Verify the proxy is alive
- Route: GET /healthz

2. List available models
- Forwards to llama server model list
- Route: GET /v1/models

3. Generate chat completions
- OpenAI-compatible style request body
- Route: POST /v1/chat/completions
- Supports normal JSON responses and streaming responses

## Request Limits and Validation

The proxy enforces these protections:

- Per-client rate limit: REQUESTS_PER_MINUTE
- Max prompt character count: MAX_PROMPT_CHARS
- Max completion tokens per request: MAX_TOKENS_PER_REQUEST
- Upstream timeout: REQUEST_TIMEOUT_SECONDS
- Optional strict model pin: ALLOWED_MODEL

Common validation errors:

- 400 messages cannot be empty
- 400 Prompt exceeds MAX_PROMPT_CHARS
- 400 max_tokens exceeds MAX_TOKENS_PER_REQUEST
- 400 Only model '<allowed_model>' is allowed
- 429 Too many requests

## Endpoint Details

### 1) Health Check

Method: GET
Route: /healthz
Auth: Not required

Success response example:

~~~json
{
  "status": "ok"
}
~~~

### 2) List Models

Method: GET
Route: /v1/models
Auth: Required

PowerShell example:

~~~powershell
$apiKey = "YOUR_API_KEY"
$headers = @{ Authorization = "Bearer $apiKey" }
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8001/v1/models" -Headers $headers
~~~

curl example:

~~~bash
curl -X GET "http://127.0.0.1:8001/v1/models" \
  -H "Authorization: Bearer YOUR_API_KEY"
~~~

### 3) Chat Completions (Non-Streaming)

Method: POST
Route: /v1/chat/completions
Auth: Required

Request body fields currently supported by the proxy:

- model (string, optional)
- messages (array, required)
- max_tokens (integer, optional)
- temperature (number, optional)
- stream (boolean, optional, default false)

PowerShell example:

~~~powershell
$apiKey = "YOUR_API_KEY"
$headers = @{ Authorization = "Bearer $apiKey" }

$body = @{
  model = "qwen3-14b-q4_k_m"
  messages = @(
    @{ role = "system"; content = "You are a concise assistant." },
    @{ role = "user"; content = "Give me 3 bullet points on GPU memory optimization." }
  )
  max_tokens = 200
  temperature = 0.7
} | ConvertTo-Json -Depth 8

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8001/v1/chat/completions" -Headers $headers -Body $body -ContentType "application/json"
~~~

curl example:

~~~bash
curl -X POST "http://127.0.0.1:8001/v1/chat/completions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-14b-q4_k_m",
    "messages": [
      {"role": "system", "content": "You are a concise assistant."},
      {"role": "user", "content": "Explain quantization in simple terms."}
    ],
    "max_tokens": 180,
    "temperature": 0.6
  }'
~~~

Note: For non-streaming requests, the proxy adds proxy_metadata.latency_ms to the response.

### 4) Chat Completions (Streaming)

Method: POST
Route: /v1/chat/completions
Auth: Required
Set stream to true

curl streaming example:

~~~bash
curl -N -X POST "http://127.0.0.1:8001/v1/chat/completions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-14b-q4_k_m",
    "stream": true,
    "messages": [
      {"role": "user", "content": "Write a short poem about local inference."}
    ],
    "max_tokens": 120
  }'
~~~

The response stream is sent as text/event-stream.

## Public Internet Request Pattern

After tunnel setup, switch only the base URL.

Example:

- Local: http://127.0.0.1:8001/v1/chat/completions
- Public: https://your-domain/v1/chat/completions

Everything else (headers and JSON body) stays the same.

## Quick Troubleshooting

1. Health endpoint fails
- Check proxy process is running on port 8001.

2. 500 API_KEYS is not configured
- Set API_KEYS in .env and restart proxy.

3. 400 Only model is allowed
- Use the exact ALLOWED_MODEL string from .env.

4. 429 Too many requests
- Reduce request rate or raise REQUESTS_PER_MINUTE.

5. 5xx from completions
- Verify llama server is running and reachable at LLAMA_BASE_URL.

## Security Notes

- Never expose raw llama server directly to the internet.
- Keep using the proxy plus tunnel.
- Rotate API keys if they were shared in logs or chat.
