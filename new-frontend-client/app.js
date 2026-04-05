/* ═══════════════════════════════════════════════
   StackMind app.js — All API logic preserved,
   enhanced UX layer on top
   ═══════════════════════════════════════════════ */

// ── Element refs ──────────────────────────────────────
const apiBaseEl       = document.getElementById("apiBase");
const apiKeyEl        = document.getElementById("apiKey");
const modelEl         = document.getElementById("model");
const systemPromptEl  = document.getElementById("systemPrompt");
const userPromptEl    = document.getElementById("userPrompt");
const maxTokensEl     = document.getElementById("maxTokens");
const temperatureEl   = document.getElementById("temperature");
const metaOutputEl    = document.getElementById("metaOutput");
const chatOutputEl    = document.getElementById("chatOutput");
const chatMessagesEl  = document.getElementById("chatMessages");
const chatEmptyEl     = document.getElementById("chatEmpty");

const healthBtn       = document.getElementById("healthBtn");
const modelsBtn       = document.getElementById("modelsBtn");
const sendBtn         = document.getElementById("sendBtn");
const clearLogBtn     = document.getElementById("clearLogBtn");
const clearChatBtn    = document.getElementById("clearChatBtn");
const copyRawBtn      = document.getElementById("copyRawBtn");
const searchBtn       = document.getElementById("searchBtn");
const searchQueryEl   = document.getElementById("searchQuery");
const searchOutputEl  = document.getElementById("searchOutput");
const searchResultEl  = document.getElementById("searchResultPanel");
const searchEmptyEl   = document.getElementById("searchEmpty");
const searchMetaEl    = document.getElementById("searchMeta");
const copySearchBtn   = document.getElementById("copySearchBtn");

const adminHealthBtn  = document.getElementById("adminHealthBtn");
const adminModelsBtn  = document.getElementById("adminModelsBtn");
const adminOutputEl   = document.getElementById("adminOutput");
const clearAdminLogBtn= document.getElementById("clearAdminLogBtn");
const togglePwBtn     = document.getElementById("togglePw");

const cfgApiBaseEl    = document.getElementById("cfgApiBase");
const cfgApiKeyEl     = document.getElementById("cfgApiKey");
const cfgModelEl      = document.getElementById("cfgModel");
const cfgSaveBtn      = document.getElementById("cfgSaveBtn");

const statusDotEl     = document.getElementById("statusDot");
const statusTextEl    = document.getElementById("statusText");
const modelBadgeEl    = document.getElementById("modelBadgeText");
const reqCountEl      = document.getElementById("reqCountBadge");
const sidebarEl       = document.getElementById("sidebar");
const sidebarToggleEl = document.getElementById("sidebarToggle");
const mobileMenuEl    = document.getElementById("mobileMenu");
const toastEl         = document.getElementById("toast");

// Dashboard refs
const dashApibaseEl   = document.getElementById("dash-apibase");
const dashModelEl     = document.getElementById("dash-model");
const dashHealthEl    = document.getElementById("dash-health");
const dashMsgsEl      = document.getElementById("dash-msgs");

// Admin overview refs
const ovEndpointEl    = document.getElementById("ov-endpoint");
const ovModelEl       = document.getElementById("ov-model");
const ovHealthEl      = document.getElementById("ov-health");
const ovReqsEl        = document.getElementById("ov-reqs");

// ── State ─────────────────────────────────────────────
let msgCount    = 0;
let toastTimer  = null;
let lastRaw     = "—";
let lastSearch  = "";

// ── Toast ─────────────────────────────────────────────
function showToast(msg, type = "info", duration = 2800) {
  if (toastTimer) clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className   = `toast ${type} show`;
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
  }, duration);
}

// ── Status ────────────────────────────────────────────
function setStatus(state, text) {
  statusDotEl.className  = `status-dot ${state}`;
  statusTextEl.textContent = text;
}

// ── Dashboard sync ────────────────────────────────────
function syncDashboard() {
  const base  = apiBaseEl.value.trim();
  const model = modelEl.value.trim();
  dashApibaseEl.textContent = base  || "—";
  dashModelEl.textContent   = model || "—";
  dashMsgsEl.textContent    = msgCount;
  ovEndpointEl.textContent  = base  || "—";
  ovModelEl.textContent     = model || "—";
  ovReqsEl.textContent      = msgCount;
  modelBadgeEl.textContent  = model || "—";
  reqCountEl.textContent    = `${msgCount} req`;
}

// ── API helpers (unchanged logic) ─────────────────────
function getBaseUrl() {
  return apiBaseEl.value.trim().replace(/\/$/, "");
}

function getAuthHeaders(includeJson = false) {
  const key = apiKeyEl.value.trim();
  const headers = { Authorization: `Bearer ${key}` };
  if (includeJson) headers["Content-Type"] = "application/json";
  return headers;
}

async function callJson(path, options = {}) {
  const url  = `${getBaseUrl()}${path}`;
  const resp = await fetch(url, options);
  const text = await resp.text();
  let parsed;
  try   { parsed = text ? JSON.parse(text) : {}; }
  catch { parsed = { raw: text }; }
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${JSON.stringify(parsed)}`);
  return parsed;
}

// ── Log helpers ───────────────────────────────────────
function printMeta(value) {
  const t = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  metaOutputEl.textContent = t;
}

function printAdmin(value) {
  const t = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  adminOutputEl.textContent = t;
}

function printChat(value) {
  lastRaw = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  chatOutputEl.textContent = lastRaw;
}

// ── Navigation ────────────────────────────────────────
const PAGE_TITLES = {
  dashboard: ["Dashboard",       "Overview"],
  chat:      ["Chat",            "Conversation"],
  search:    ["Knowledge Search","Query"],
  admin:     ["Admin",           "System Overview"],
  config:    ["Config",          "Quick Setup"],
};

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", e => {
    e.preventDefault();
    const sec = item.dataset.section;
    if (!sec) return;

    document.querySelectorAll(".nav-item").forEach(n => {
      n.classList.remove("active");
      n.querySelector(".nav-pip")?.remove();
    });
    item.classList.add("active");

    // Add pip to active
    if (!item.querySelector(".nav-pip")) {
      const pip = document.createElement("span");
      pip.className = "nav-pip";
      item.appendChild(pip);
    }

    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    document.getElementById(`sec-${sec}`)?.classList.add("active");

    const [title, crumb] = PAGE_TITLES[sec] || [sec, sec];
    document.getElementById("pageTitle").textContent = title;
    document.getElementById("bcPage").textContent    = crumb;

    if (sec === "dashboard") syncDashboard();

    // Close mobile sidebar
    sidebarEl.classList.remove("mobile-open");
  });
});

// ── Sidebar collapse ──────────────────────────────────
sidebarToggleEl.addEventListener("click", () => {
  sidebarEl.classList.toggle("collapsed");
});

mobileMenuEl.addEventListener("click", () => {
  sidebarEl.classList.toggle("mobile-open");
});

// ── Toggle password ───────────────────────────────────
togglePwBtn?.addEventListener("click", () => {
  apiKeyEl.type = apiKeyEl.type === "password" ? "text" : "password";
});

// ── Auto-resize textarea ──────────────────────────────
userPromptEl.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 140) + "px";
});

// ── Health check ──────────────────────────────────────
async function doHealth(outputFn) {
  setStatus("busy", "Checking…");
  outputFn("Checking health…");
  try {
    const data = await callJson("/healthz", { method: "GET" });
    outputFn(data);
    dashHealthEl.textContent = "✓ OK";
    ovHealthEl.textContent   = "✓ OK";
    setStatus("ok", "Healthy");
    showToast("Health check passed", "success");
    setTimeout(() => setStatus("idle", "Idle"), 3000);
  } catch (err) {
    outputFn(err.message);
    dashHealthEl.textContent = "✗ Error";
    ovHealthEl.textContent   = "✗ Error";
    setStatus("error", "Error");
    showToast(err.message, "error", 4000);
    setTimeout(() => setStatus("idle", "Idle"), 3500);
  }
}

healthBtn.addEventListener("click",      () => doHealth(printMeta));
adminHealthBtn.addEventListener("click", () => doHealth(printAdmin));

// ── List models ───────────────────────────────────────
async function doModels(outputFn) {
  setStatus("busy", "Loading…");
  outputFn("Loading models…");
  try {
    const data = await callJson("/v1/models", {
      method: "GET",
      headers: getAuthHeaders(false),
    });
    outputFn(data);
    setStatus("ok", "Done");
    showToast("Models loaded", "success");
    setTimeout(() => setStatus("idle", "Idle"), 2500);
  } catch (err) {
    outputFn(err.message);
    setStatus("error", "Error");
    showToast(err.message, "error", 4000);
    setTimeout(() => setStatus("idle", "Idle"), 3500);
  }
}

modelsBtn.addEventListener("click",      () => doModels(printMeta));
adminModelsBtn.addEventListener("click", () => doModels(printAdmin));

// ── Chat message rendering ────────────────────────────
function clearChatEmpty() {
  chatEmptyEl?.remove();
}

function getTimeStr() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function appendMessage(role, text) {
  clearChatEmpty();
  const isUser = role === "user";

  const wrap = document.createElement("div");
  wrap.className = `msg ${isUser ? "user" : "assist"}`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = isUser ? "U" : "AI";

  const body = document.createElement("div");
  body.className = "msg-body";
  body.textContent = text;

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = getTimeStr();

  // inner column: bubble + timestamp stacked vertically
  const inner = document.createElement("div");
  inner.className = "msg-inner";
  inner.appendChild(body);
  inner.appendChild(time);

  // user: avatar on right → reverse order
  if (isUser) {
    wrap.appendChild(inner);
    wrap.appendChild(avatar);
  } else {
    wrap.appendChild(avatar);
    wrap.appendChild(inner);
  }

  chatMessagesEl.appendChild(wrap);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function appendThinking() {
  clearChatEmpty();
  const wrap   = document.createElement("div");
  wrap.className = "msg assist";
  wrap.id = "thinking-bubble";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "AI";

  const body   = document.createElement("div");
  body.className = "msg-body";
  body.innerHTML = `<div class="thinking-dots"><span></span><span></span><span></span></div>`;

  wrap.appendChild(avatar);
  wrap.appendChild(body);
  chatMessagesEl.appendChild(wrap);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  return wrap;
}

// ── Streaming helper ──────────────────────────────────
async function streamCompletion(payload, onToken, onDone, onError) {
  const url = `${getBaseUrl()}/v1/chat/completions`;
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify({ ...payload, stream: true }),
    });
  } catch (err) {
    onError(err);
    return;
  }

  if (!resp.ok) {
    const text = await resp.text();
    onError(new Error(`HTTP ${resp.status}: ${text}`));
    return;
  }

  const reader  = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split on newlines; keep any trailing incomplete line in buffer
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") { onDone(); return; }
        try {
          const parsed = JSON.parse(data);
          const token  = parsed?.choices?.[0]?.delta?.content;
          if (token) onToken(token);
        } catch { /* ignore malformed chunks */ }
      }
    }
    onDone();
  } catch (err) {
    onError(err);
  }
}

// ── Send chat ─────────────────────────────────────────
sendBtn.addEventListener("click", async () => {
  const prompt = userPromptEl.value.trim();
  if (!prompt) {
    userPromptEl.focus();
    userPromptEl.style.border = "1px solid var(--red)";
    setTimeout(() => { userPromptEl.style.border = ""; }, 1200);
    return;
  }

  appendMessage("user", prompt);
  userPromptEl.value = "";
  userPromptEl.style.height = "auto";

  const thinking = appendThinking();
  setStatus("busy", "Waiting…");
  sendBtn.disabled = true;
  sendBtn.querySelector(".send-label").textContent = "Sending…";

  const messages = [];
  const sp = systemPromptEl.value.trim();
  if (sp) messages.push({ role: "system", content: sp });
  messages.push({ role: "user", content: prompt });

  const payload = {
    model:       modelEl.value.trim() || undefined,
    messages,
    max_tokens:  Number(maxTokensEl.value) || undefined,
    temperature: Number(temperatureEl.value) || undefined,
  };

  const t0 = Date.now();
  let assistBody = null;
  let fullText   = "";

  await streamCompletion(
    payload,
    (token) => {
      if (!assistBody) {
        thinking.remove();
        // Build the assistant bubble on first token
        const wrap   = document.createElement("div");
        wrap.className = "msg assist";
        const avatar = document.createElement("div");
        avatar.className = "msg-avatar";
        avatar.textContent = "AI";
        const body   = document.createElement("div");
        body.className = "msg-body";
        const time   = document.createElement("div");
        time.className = "msg-time";
        time.textContent = getTimeStr();
        const inner  = document.createElement("div");
        inner.className = "msg-inner";
        inner.appendChild(body);
        inner.appendChild(time);
        wrap.appendChild(avatar);
        wrap.appendChild(inner);
        chatMessagesEl.appendChild(wrap);
        assistBody = body;
        sendBtn.querySelector(".send-label").textContent = "Generating…";
      }
      fullText += token;
      assistBody.textContent = fullText;
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    },
    () => {
      if (!assistBody) thinking.remove(); // empty response edge case
      printChat(fullText || "—");
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      printMeta({ streamed: true, elapsed_s: Number(elapsed) });
      msgCount++;
      syncDashboard();
      setStatus("ok", "Done");
      showToast("Response received", "success");
      setTimeout(() => setStatus("idle", "Idle"), 2500);
      sendBtn.disabled = false;
      sendBtn.querySelector(".send-label").textContent = "Send";
    },
    (err) => {
      thinking.remove();
      appendMessage("assist", `Error: ${err.message}`);
      printChat(err.message);
      setStatus("error", "Error");
      showToast(err.message, "error", 4000);
      setTimeout(() => setStatus("idle", "Idle"), 3500);
      sendBtn.disabled = false;
      sendBtn.querySelector(".send-label").textContent = "Send";
    }
  );
});

// Enter to send (Shift+Enter = newline)
userPromptEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

// Clear chat
clearChatBtn.addEventListener("click", () => {
  chatMessagesEl.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "chat-empty";
  empty.id = "chatEmpty";
  empty.innerHTML = `
    <div class="chat-empty-icon">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><path d="M32 4H4a2 2 0 00-2 2v18a2 2 0 002 2h6l4.5 5.5L19 26h13a2 2 0 002-2V6a2 2 0 00-2-2z" stroke="var(--accent)" stroke-width="1.4" stroke-linejoin="round"/><path d="M10 14h16M10 19h10" stroke="var(--accent)" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/></svg>
    </div>
    <p class="chat-empty-title">Start a conversation</p>
    <p class="chat-empty-sub">Type below and press Enter or click Send</p>
  `;
  chatMessagesEl.appendChild(empty);
  printChat("—");
  showToast("Chat cleared", "info");
});

// Copy raw response
copyRawBtn.addEventListener("click", async () => {
  if (lastRaw && lastRaw !== "—") {
    await navigator.clipboard.writeText(lastRaw).catch(() => {});
    showToast("Copied to clipboard", "success");
  }
});

// ── Knowledge Search ──────────────────────────────────
async function doSearch(query) {
  if (!query.trim()) return;
  searchQueryEl.value = query;

  const t0 = Date.now();
  searchEmptyEl.style.display  = "none";
  searchResultEl.style.display = "block";
  searchOutputEl.textContent   = "Searching…";
  searchMetaEl.textContent     = "";
  setStatus("busy", "Searching…");

  const messages = [];
  const sp = systemPromptEl.value.trim();
  if (sp) messages.push({ role: "system", content: sp });
  messages.push({ role: "user", content: query });

  const payload = {
    model:       modelEl.value.trim() || undefined,
    messages,
    max_tokens:  Number(maxTokensEl.value) || undefined,
    temperature: 0.3,
  };

  let accumulated = "";
  searchOutputEl.textContent = "";

  await streamCompletion(
    payload,
    (token) => {
      accumulated += token;
      searchOutputEl.textContent = accumulated;
    },
    () => {
      lastSearch = accumulated || "—";
      searchOutputEl.textContent = lastSearch;
      searchMetaEl.textContent   = `${((Date.now() - t0) / 1000).toFixed(2)}s`;
      setStatus("ok", "Done");
      showToast("Search complete", "success");
      setTimeout(() => setStatus("idle", "Idle"), 2500);
    },
    (err) => {
      searchOutputEl.textContent = err.message;
      setStatus("error", "Error");
      showToast(err.message, "error", 4000);
      setTimeout(() => setStatus("idle", "Idle"), 3500);
    }
  );
}

searchBtn.addEventListener("click", () => doSearch(searchQueryEl.value));
searchQueryEl.addEventListener("keydown", e => { if (e.key === "Enter") doSearch(searchQueryEl.value); });

document.querySelectorAll(".search-tag").forEach(tag => {
  tag.addEventListener("click", () => doSearch(tag.dataset.q));
});

copySearchBtn.addEventListener("click", async () => {
  if (lastSearch) {
    await navigator.clipboard.writeText(lastSearch).catch(() => {});
    showToast("Copied to clipboard", "success");
  }
});

// ── Config Apply ──────────────────────────────────────
cfgSaveBtn.addEventListener("click", () => {
  apiBaseEl.value = cfgApiBaseEl.value;
  apiKeyEl.value  = cfgApiKeyEl.value;
  modelEl.value   = cfgModelEl.value;
  syncDashboard();
  showToast("Configuration applied ✓", "success");
  setStatus("ok", "Config saved");
  setTimeout(() => setStatus("idle", "Idle"), 2500);
});

// ── Clear logs ────────────────────────────────────────
clearLogBtn.addEventListener("click", () => {
  metaOutputEl.textContent = "Log cleared.";
  showToast("Log cleared", "info");
});

clearAdminLogBtn.addEventListener("click", () => {
  adminOutputEl.textContent = "Log cleared.";
  showToast("Log cleared", "info");
});

// ── Sync admin inputs → live ──────────────────────────
[apiBaseEl, modelEl].forEach(el => el.addEventListener("input", syncDashboard));

// ── Init ──────────────────────────────────────────────
syncDashboard();