# Frontend Client

A simple isolated browser UI for your proxy API domain.

## Files

- index.html: UI layout
- styles.css: styles
- app.js: API calls and chat logic

This is the primary StackMind UI (see the repository root [README.md](../../README.md)).

## Run locally

From the repository root:

~~~powershell
cd frontend-new-new-new\frontend-client
python -m http.server 5500
~~~

Open:

- http://127.0.0.1:5500

## How to use

1. Set API Base URL to your endpoint, for example:
- http://127.0.0.1:8001 (local)
- your Cloudflare domain (public)

2. Paste API key (Bearer token only, without the word Bearer) or sign in with a user account.

3. Keep model as whatever `ALLOWED_MODEL` is set to in `.env`, e.g.:
- qwen25-coder-3b-stackoverflow-q4_k_m

4. Click Check Health, then List Models.

5. Enter prompt and click Send.

## Important CORS note

If this frontend is served from a different origin than your API domain, browser requests may be blocked by CORS unless your API allows that origin.

If you see browser CORS errors, host this frontend on the same domain as the API, or add CORS support in the FastAPI proxy.
