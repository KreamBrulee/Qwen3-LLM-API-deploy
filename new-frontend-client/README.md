# Frontend Client

A simple isolated browser UI for your proxy API domain.

## Files

- index.html: UI layout
- styles.css: styles
- app.js: API calls and chat logic

## Run locally

From the repository root:

~~~powershell
cd e:\Kunal\VS_shit\LLM-deploy\frontend-client
python -m http.server 5500
~~~

Open:

- http://127.0.0.1:5500

## How to use

1. Set API Base URL to your public endpoint, for example:
- https://llm-api.example.com

2. Paste API key (Bearer token only, without the word Bearer).

3. Keep model as:
- qwen3-14b-q4_k_m

4. Click Check Health, then List Models.

5. Enter prompt and click Send.

## Important CORS note

If this frontend is served from a different origin than your API domain, browser requests may be blocked by CORS unless your API allows that origin.

If you see browser CORS errors, host this frontend on the same domain as the API, or add CORS support in the FastAPI proxy.
