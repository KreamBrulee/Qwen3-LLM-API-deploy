const apiBaseEl = document.getElementById("apiBase");
const apiKeyEl = document.getElementById("apiKey");
const modelEl = document.getElementById("model");
const systemPromptEl = document.getElementById("systemPrompt");
const userPromptEl = document.getElementById("userPrompt");
const maxTokensEl = document.getElementById("maxTokens");
const temperatureEl = document.getElementById("temperature");
const metaOutputEl = document.getElementById("metaOutput");
const chatOutputEl = document.getElementById("chatOutput");

const healthBtn = document.getElementById("healthBtn");
const modelsBtn = document.getElementById("modelsBtn");
const sendBtn = document.getElementById("sendBtn");

function getBaseUrl() {
  return apiBaseEl.value.trim().replace(/\/$/, "");
}

function getAuthHeaders(includeJson = false) {
  const key = apiKeyEl.value.trim();
  const headers = {
    Authorization: `Bearer ${key}`,
  };
  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

function printMeta(value) {
  metaOutputEl.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function printChat(value) {
  chatOutputEl.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

async function callJson(path, options = {}) {
  const url = `${getBaseUrl()}${path}`;
  const response = await fetch(url, options);
  const text = await response.text();

  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(parsed)}`);
  }

  return parsed;
}

healthBtn.addEventListener("click", async () => {
  printMeta("Checking health...");
  try {
    const data = await callJson("/healthz", { method: "GET" });
    printMeta(data);
  } catch (err) {
    printMeta(err.message);
  }
});

modelsBtn.addEventListener("click", async () => {
  printMeta("Loading models...");
  try {
    const data = await callJson("/v1/models", {
      method: "GET",
      headers: getAuthHeaders(false),
    });
    printMeta(data);
  } catch (err) {
    printMeta(err.message);
  }
});

sendBtn.addEventListener("click", async () => {
  const userPrompt = userPromptEl.value.trim();
  if (!userPrompt) {
    printChat("Enter a user prompt first.");
    return;
  }

  printChat("Waiting for model response...");

  const messages = [];
  const systemPrompt = systemPromptEl.value.trim();
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userPrompt });

  const payload = {
    model: modelEl.value.trim() || undefined,
    messages,
    max_tokens: Number(maxTokensEl.value) || undefined,
    temperature: Number(temperatureEl.value) || undefined,
  };

  try {
    const data = await callJson("/v1/chat/completions", {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify(payload),
    });

    const content = data?.choices?.[0]?.message?.content;
    if (content) {
      printChat(content);
    } else {
      printChat(data);
    }

    if (data?.proxy_metadata) {
      printMeta(data.proxy_metadata);
    }
  } catch (err) {
    printChat(err.message);
  }
});
