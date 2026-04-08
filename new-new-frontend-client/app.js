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
const stopBtn         = document.getElementById("stopBtn");
const typingIndicator = document.getElementById("typingIndicator");
const moodBarEl       = document.getElementById("moodBar");
const moodEmojiEl     = document.getElementById("moodEmoji");
const moodLabelEl     = document.getElementById("moodLabel");

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

// Auth element refs
const authOverlayEl    = document.getElementById("authOverlay");
const tabLoginEl       = document.getElementById("tabLogin");
const tabRegisterEl    = document.getElementById("tabRegister");
const loginFormEl      = document.getElementById("loginForm");
const registerFormEl   = document.getElementById("registerForm");
const loginUsernameEl  = document.getElementById("loginUsername");
const loginPasswordEl  = document.getElementById("loginPassword");
const regUsernameEl    = document.getElementById("regUsername");
const regPasswordEl    = document.getElementById("regPassword");
const authErrorEl      = document.getElementById("authError");
const logoutBtnEl      = document.getElementById("logoutBtn");
const userPillEl       = document.getElementById("userPill");
const profileDropdownEl= document.getElementById("profileDropdown");
const profileAvatarEl  = document.getElementById("profileAvatar");
const profileMenuEl    = document.getElementById("profileMenu");
const avatarLetterEl   = document.getElementById("avatarLetter");
const profileMenuNameEl= document.getElementById("profileMenuName");
const profileMenuRoleEl= document.getElementById("profileMenuRole");
const dashHealthBtn    = document.getElementById("dashHealthBtn");
const dashModelsBtn    = document.getElementById("dashModelsBtn");
const dashHealthOutEl  = document.getElementById("dashHealthOutput");
const dashModelsOutEl  = document.getElementById("dashModelsOutput");
const dashGreetingEl   = document.getElementById("dashGreeting");
const heroReqCountEl   = document.getElementById("heroReqCount");
const heroUptimeEl     = document.getElementById("heroUptime");
const qaHealthBtnEl    = document.getElementById("qaHealthBtn");
const qaModelsBtnEl    = document.getElementById("qaModelsBtn");

// ── Mascot upload ─────────────────────────────────────
const mascotUploadEl   = document.getElementById("mascotUpload");
const mascotImgEl      = document.getElementById("authMascotImg");
const mascotFallbackEl = document.getElementById("authMascotFallback");

mascotUploadEl?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    mascotImgEl.src = dataUrl;
    mascotImgEl.style.display = "";
    mascotFallbackEl.style.display = "none";
    try { localStorage.setItem("sm_mascot", dataUrl); } catch {}
  };
  reader.readAsDataURL(file);
});

// Restore saved mascot
(function restoreMascot() {
  try {
    const saved = localStorage.getItem("sm_mascot");
    if (saved) {
      mascotImgEl.src = saved;
      mascotImgEl.style.display = "";
      mascotFallbackEl.style.display = "none";
    }
  } catch {}
})();

// ── State ─────────────────────────────────────────────
let msgCount    = 0;
let toastTimer  = null;
let lastRaw     = "—";
let lastSearch  = "";
let currentUser = null;  // { token, username, user_id, is_admin } or null
let currentAbortController = null;  // for stopping generation

// ── Mood system ───────────────────────────────────────
// Tracks "coding mood" based on chat activity patterns
const MOODS = [
  { key: "chill",   emoji: "😌", label: "Chill",        minMsgs: 0,  minSpeed: 0 },
  { key: "focused", emoji: "🎯", label: "Focused",      minMsgs: 2,  minSpeed: 0 },
  { key: "hyped",   emoji: "⚡", label: "In The Zone",  minMsgs: 5,  minSpeed: 3 },
  { key: "deep",    emoji: "🧠", label: "Deep Thought", minMsgs: 8,  minSpeed: 0 },
  { key: "fire",    emoji: "🔥", label: "On Fire!",     minMsgs: 12, minSpeed: 5 },
];

let moodMsgTimestamps = [];  // timestamps of recent messages

function updateMood() {
  const now = Date.now();
  // Only count messages in the last 5 minutes
  moodMsgTimestamps = moodMsgTimestamps.filter(t => now - t < 5 * 60 * 1000);
  const recentCount = moodMsgTimestamps.length;

  // Messages per minute
  const span = moodMsgTimestamps.length >= 2
    ? (moodMsgTimestamps[moodMsgTimestamps.length - 1] - moodMsgTimestamps[0]) / 60000
    : 1;
  const speed = recentCount / Math.max(span, 0.5);

  // Pick the highest mood that matches
  let mood = MOODS[0];
  for (const m of MOODS) {
    if (recentCount >= m.minMsgs && speed >= m.minSpeed) mood = m;
  }

  moodBarEl.dataset.mood   = mood.key;
  moodEmojiEl.textContent  = mood.emoji;
  moodLabelEl.textContent  = mood.label;

  // Little bounce animation on change
  moodEmojiEl.style.transform = "scale(1.4) rotate(-10deg)";
  setTimeout(() => { moodEmojiEl.style.transform = ""; }, 300);
}

// ── Particle burst (fun surprise on send) ─────────────
function spawnParticles(targetEl, count = 6) {
  const emojis = ["✨", "⚡", "💫", "🚀", "🌟", "💬"];
  const rect = targetEl.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "chat-particle";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 60) + "px";
    el.style.top  = (rect.top + (Math.random() - 0.5) * 20) + "px";
    el.style.animationDuration = (0.8 + Math.random() * 0.6) + "s";
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }
}

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
  dashApibaseEl.textContent = base  || "--";
  dashModelEl.textContent   = model || "--";
  dashMsgsEl.textContent    = msgCount;
  ovEndpointEl.textContent  = base  || "--";
  ovModelEl.textContent     = model || "--";
  ovReqsEl.textContent      = msgCount;
  modelBadgeEl.textContent  = model || "--";
  reqCountEl.textContent    = `${msgCount} req`;
  if (heroReqCountEl) heroReqCountEl.textContent = msgCount;
  // Sidebar model card sync
  const sidebarModelName = document.getElementById("sidebarModelName");
  if (sidebarModelName) sidebarModelName.textContent = model || "--";
  // Usage meter sync
  const meterMsgs = document.getElementById("meterMsgs");
  const meterMsgsFill = document.getElementById("meterMsgsFill");
  if (meterMsgs) meterMsgs.textContent = `${msgCount} / 50`;
  if (meterMsgsFill) meterMsgsFill.style.width = `${Math.min((msgCount / 50) * 100, 100)}%`;
  // Chat badge
  const navChatBadge = document.getElementById("navChatBadge");
  if (navChatBadge) {
    if (msgCount > 0) {
      navChatBadge.style.display = "";
      navChatBadge.textContent = msgCount;
    } else {
      navChatBadge.style.display = "none";
    }
  }
  // Pulse animation on request count change
  if (dashMsgsEl && msgCount > 0) {
    dashMsgsEl.style.transition = "transform 0.15s ease";
    dashMsgsEl.style.transform = "scale(1.15)";
    setTimeout(() => { dashMsgsEl.style.transform = "scale(1)"; }, 150);
  }
}

// ── Time-based greeting ──────────────────────────────
function updateGreeting(username) {
  const h = new Date().getHours();
  const name = username || (currentUser ? currentUser.username : null);
  let timeGreet;
  if (h < 5)       timeGreet = "Burning the midnight oil";
  else if (h < 12) timeGreet = "Good morning";
  else if (h < 17) timeGreet = "Good afternoon";
  else              timeGreet = "Good evening";
  const greeting = name ? `${timeGreet}, ${name}` : `${timeGreet}, welcome back`;
  if (dashGreetingEl) dashGreetingEl.textContent = greeting;
}
updateGreeting();

// ── Session uptime ───────────────────────────────────
const sessionStart = Date.now();
function updateUptime() {
  const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (heroUptimeEl) {
    heroUptimeEl.textContent = h > 0
      ? `${h}:${String(mm).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${String(mm).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  // Sidebar uptime meter (max 60 min = 100%)
  const meterUptime = document.getElementById("meterUptime");
  const meterUptimeFill = document.getElementById("meterUptimeFill");
  if (meterUptime) meterUptime.textContent = h > 0 ? `${h}h ${mm}m` : `${m}m`;
  if (meterUptimeFill) meterUptimeFill.style.width = `${Math.min((m / 60) * 100, 100)}%`;
}
setInterval(updateUptime, 1000);
updateUptime();

// ── Neural Network Canvas Animation ─────────────────
(function initNeuralCanvas() {
  const canvas = document.getElementById("neuralCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, nodes = [], edges = [];
  const NODE_COUNT = 28;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    W = canvas.width = rect.width * (window.devicePixelRatio || 1);
    H = canvas.height = rect.height * (window.devicePixelRatio || 1);
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  }

  function initNodes() {
    const rW = canvas.parentElement.getBoundingClientRect().width;
    const rH = canvas.parentElement.getBoundingClientRect().height;
    nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * rW,
        y: Math.random() * rH,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: 2 + Math.random() * 2.5,
        pulse: Math.random() * Math.PI * 2,
      });
    }
    edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (Math.random() < 0.15) edges.push([i, j]);
      }
    }
  }

  function draw() {
    const rW = canvas.parentElement.getBoundingClientRect().width;
    const rH = canvas.parentElement.getBoundingClientRect().height;
    ctx.clearRect(0, 0, rW, rH);
    const t = Date.now() * 0.001;

    // Move nodes
    nodes.forEach((n) => {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > rW) n.vx *= -1;
      if (n.y < 0 || n.y > rH) n.vy *= -1;
      n.pulse += 0.02;
    });

    // Draw edges
    edges.forEach(([i, j]) => {
      const a = nodes[i], b = nodes[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < 120) {
        const alpha = (1 - dist / 120) * 0.25;
        ctx.strokeStyle = `rgba(59,130,246,${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // Pulse along edge
        const pulse = (Math.sin(t * 2 + i) + 1) / 2;
        const px = a.x + (b.x - a.x) * pulse;
        const py = a.y + (b.y - a.y) * pulse;
        ctx.fillStyle = `rgba(6,182,212,${alpha * 1.5})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw nodes
    nodes.forEach((n) => {
      const glow = 0.5 + Math.sin(n.pulse) * 0.3;
      ctx.fillStyle = `rgba(59,130,246,${glow})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
      // Outer glow
      ctx.fillStyle = `rgba(59,130,246,${glow * 0.15})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 3, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  resize();
  initNodes();
  draw();
  window.addEventListener("resize", () => { resize(); initNodes(); });
})();

// ── Live Activity Feed ───────────────────────────────
const activityFeedEl = document.getElementById("activityFeed");
const activityLog = [];

function addActivity(icon, text) {
  if (!activityFeedEl) return;
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  activityLog.unshift({ icon, text, time: timeStr });
  if (activityLog.length > 30) activityLog.pop();

  const item = document.createElement("div");
  item.className = "feed-item";
  item.style.cssText = "--i:0";
  item.innerHTML = `
    <div class="feed-icon ${icon}">
      ${getFeedIconSvg(icon)}
    </div>
    <div class="feed-content">
      <span class="feed-text">${text}</span>
      <span class="feed-time">${timeStr}</span>
    </div>
  `;
  activityFeedEl.prepend(item);
  // Keep feed manageable
  while (activityFeedEl.children.length > 20) {
    activityFeedEl.lastElementChild.remove();
  }
}

function getFeedIconSvg(type) {
  const svgs = {
    health:  '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1 7h2.5l2-4 2 8 2-5 1 1H13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    model:   '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>',
    chat:    '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M12 1H2a1 1 0 00-1 1v7a1 1 0 001 1h2l2 2.5L8 10h4a1 1 0 001-1V2a1 1 0 00-1-1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
    search:  '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="5.5" cy="5.5" r="4" stroke="currentColor" stroke-width="1.3"/><path d="M13 13l-3.5-3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    error:   '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M7 4v4M7 10h.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    config:  '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2" stroke="currentColor" stroke-width="1.3"/><path d="M7 1v2M7 11v2M1 7h2M11 7h2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    boot:    '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  return svgs[type] || svgs.boot;
}

// ── Rotating Pro Tips ────────────────────────────────
const tips = [
  "Use the system prompt to define your AI's personality and behavior for every conversation.",
  "Try lowering temperature to 0.2 for factual tasks, or raise to 1.2 for creative writing.",
  "Use Knowledge Search for single-shot queries without maintaining chat context.",
  "Your chat history persists across sessions -- come back anytime to continue.",
  "Press Enter to send a message, or Shift+Enter for a new line in the composer.",
];
let currentTip = 0;
const tipTextEl = document.getElementById("tipText");
const tipDots = document.querySelectorAll(".tip-dot");
const nextTipBtn = document.getElementById("nextTipBtn");

function showTip(index) {
  currentTip = index % tips.length;
  if (tipTextEl) {
    tipTextEl.style.opacity = "0";
    setTimeout(() => {
      tipTextEl.textContent = tips[currentTip];
      tipTextEl.style.opacity = "1";
    }, 200);
  }
  tipDots.forEach((dot, i) => {
    dot.classList.toggle("active", i === currentTip);
  });
}

nextTipBtn?.addEventListener("click", () => showTip(currentTip + 1));

// Auto-rotate tips every 8 seconds
setInterval(() => showTip(currentTip + 1), 8000);

// ── Chat hint chips ──────────────────────────────────
document.querySelectorAll(".hint-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const hint = chip.getAttribute("data-hint");
    const promptEl = document.getElementById("userPrompt");
    if (promptEl && hint) {
      promptEl.value = hint;
      promptEl.focus();
      promptEl.dispatchEvent(new Event("input"));
      // Navigate to chat
      const chatNav = document.querySelector('.nav-item[data-section="chat"]');
      if (chatNav) chatNav.click();
    }
  });
});

// ── API helpers (unchanged logic) ─────────────────────
function getBaseUrl() {
  return apiBaseEl.value.trim().replace(/\/$/, "");
}

function getAuthHeaders(includeJson = false) {
  const key = currentUser ? currentUser.token : apiKeyEl.value.trim();
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
    addActivity("health", "Health check passed — API is healthy");
    if (document.getElementById("neuralLatency")) document.getElementById("neuralLatency").textContent = "OK";
    setTimeout(() => setStatus("idle", "Idle"), 3000);
  } catch (err) {
    outputFn(err.message);
    dashHealthEl.textContent = "✗ Error";
    ovHealthEl.textContent   = "✗ Error";
    setStatus("error", "Error");
    showToast(err.message, "error", 4000);
    addActivity("error", "Health check failed");
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
    const count = data?.data?.length || "?";
    addActivity("model", `Loaded ${count} model(s) from API`);
    setTimeout(() => setStatus("idle", "Idle"), 2500);
  } catch (err) {
    outputFn(err.message);
    setStatus("error", "Error");
    showToast(err.message, "error", 4000);
    addActivity("error", "Failed to load models");
    setTimeout(() => setStatus("idle", "Idle"), 3500);
  }
}

modelsBtn.addEventListener("click",      () => doModels(printMeta));
adminModelsBtn.addEventListener("click", () => doModels(printAdmin));

// ── Dashboard inline health / models ─────────────────
function printDashHealth(value) {
  const t = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  dashHealthOutEl.textContent = t;
}
function printDashModels(value) {
  const t = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  dashModelsOutEl.textContent = t;
}
dashHealthBtn.addEventListener("click", () => doHealth(printDashHealth));
dashModelsBtn.addEventListener("click", () => doModels(printDashModels));

// ── Quick action buttons ─────────────────────────────
qaHealthBtnEl?.addEventListener("click", () => doHealth(printDashHealth));
qaModelsBtnEl?.addEventListener("click", () => doModels(printDashModels));

// Quick action nav buttons (data-nav attribute)
document.querySelectorAll(".quick-action-btn[data-nav]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-nav");
    const navItem = document.querySelector(`.nav-item[data-section="${target}"]`);
    if (navItem) navItem.click();
  });
});

// ── Auto health check on page load ───────────────────
setTimeout(() => {
  doHealth(printDashHealth);
}, 800);

// ── Profile dropdown toggle ──────────────────────────
profileAvatarEl.addEventListener("click", (e) => {
  e.stopPropagation();
  profileMenuEl.classList.toggle("open");
});
document.addEventListener("click", () => {
  profileMenuEl.classList.remove("open");
});
profileMenuEl.addEventListener("click", (e) => e.stopPropagation());

// ── Keyboard shortcut navigation (Alt+1..4) ─────────
document.addEventListener("keydown", (e) => {
  // Don't trigger if typing in an input
  if (e.target.matches("input, textarea, select")) return;
  const sections = ["chat", "search", "admin", "config"];
  if (e.altKey && e.key >= "1" && e.key <= "4") {
    e.preventDefault();
    const target = sections[Number(e.key) - 1];
    const navItem = document.querySelector(`.nav-item[data-section="${target}"]`);
    if (navItem && navItem.style.display !== "none") navItem.click();
  }
  // Alt+D for dashboard
  if (e.altKey && (e.key === "d" || e.key === "D")) {
    e.preventDefault();
    const navItem = document.querySelector('.nav-item[data-section="dashboard"]');
    if (navItem) navItem.click();
  }
});

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

// ── Message classifier (used for non-admin users) ─────
function classifyMessage(text) {
  const lower     = text.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;

  // Temperature
  let temperature = 0.72;
  if (/\b(write|create|imagine|story|poem|creative|brainstorm|idea|invent|fiction|generate|design|craft|compose|narrative|character|plot|song|lyrics|script|roleplay|fantasy)\b/.test(lower))
    temperature = 0.92;
  else if (/\b(analyz|analys|compare|evaluat|pros|cons|difference|versus|\bvs\b|review|assess|contrast|weigh|opinion|argue|debate)\b/.test(lower))
    temperature = 0.5;
  else if (/\b(what is|what are|how does|how do|explain|define|calculat|convert|translat|syntax|error|bug|fix|debug|code|function|class|implement|api|formula|equation)\b/.test(lower))
    temperature = 0.25;

  // max_tokens — scale with length, higher ceiling now that limit is 4096
  let max_tokens = Math.min(Math.max(200 + wordCount * 20, 300), 1800);
  if (/\b(essay|detailed|comprehensive|complete|full|entire|step.by.step|tutorial|guide|list all|everything about|in depth|thorough|exhaustive|long)\b/.test(lower))
    max_tokens = 4096;
  else if (/\b(story|narrative|chapter|short story|fiction|script|write me a|tell me a)\b/.test(lower))
    max_tokens = 3000;
  else if (wordCount <= 6 && /^(what is|what are|who is|when|where|define|yes|no)/.test(lower))
    max_tokens = 150;

  return { temperature, max_tokens };
}

// ── Admin role UI toggle ───────────────────────────────
function applyUserRole(isAdmin) {
  const adminNav      = document.getElementById("adminNavItem");
  const composerCtrl  = document.getElementById("composerControls");
  if (adminNav)     adminNav.style.display     = isAdmin ? "" : "none";
  if (composerCtrl) composerCtrl.style.display = isAdmin ? "" : "none";
}

// ── Streaming helper ──────────────────────────────────
// onToken(token)          — called for each real content token
// onReasoning(token)      — called for each reasoning/thinking token (optional)
// onDone()                — called when stream ends
// onError(err)            — called on fetch/parse error
async function streamCompletion(payload, onToken, onDone, onError, onReasoning, abortSignal) {
  const url = `${getBaseUrl()}/v1/chat/completions`;
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify({ ...payload, stream: true }),
      signal: abortSignal,
    });
  } catch (err) {
    if (err.name === "AbortError") { onDone(); return; }
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
          const delta  = parsed?.choices?.[0]?.delta ?? {};
          if (delta.content)           onToken(delta.content);
          if (delta.reasoning_content && onReasoning) onReasoning(delta.reasoning_content);
        } catch { /* ignore malformed chunks */ }
      }
    }
    onDone();
  } catch (err) {
    if (err.name === "AbortError") { onDone(); return; }
    onError(err);
  }
}

// ── UI helpers for generation state ───────────────────
function enterGeneratingState() {
  sendBtn.style.display = "none";
  stopBtn.style.display = "flex";
  typingIndicator.classList.add("active");
}

function exitGeneratingState() {
  sendBtn.style.display = "";
  sendBtn.disabled = false;
  sendBtn.querySelector(".send-label").textContent = "Send";
  stopBtn.style.display = "none";
  typingIndicator.classList.remove("active");
  currentAbortController = null;
}

// ── Stop button ──────────────────────────────────────
stopBtn.addEventListener("click", () => {
  if (currentAbortController) {
    currentAbortController.abort();
    showToast("Generation stopped", "info");
  }
});

// ── Send chat ─────────────────────────────────────────
sendBtn.addEventListener("click", async () => {
  const prompt = userPromptEl.value.trim();
  if (!prompt) {
    userPromptEl.focus();
    userPromptEl.style.border = "1px solid var(--red)";
    setTimeout(() => { userPromptEl.style.border = ""; }, 1200);
    return;
  }

  // Track mood
  moodMsgTimestamps.push(Date.now());
  updateMood();

  // Particle burst on send
  spawnParticles(sendBtn, 5);

  appendMessage("user", prompt);
  userPromptEl.value = "";
  userPromptEl.style.height = "auto";

  const thinking = appendThinking();
  setStatus("busy", "Waiting…");
  enterGeneratingState();

  // Create abort controller for this request
  currentAbortController = new AbortController();

  const messages = [];
  const sp = systemPromptEl.value.trim();
  if (sp) messages.push({ role: "system", content: sp });
  messages.push({ role: "user", content: prompt });

  const inferredParams = currentUser?.is_admin
    ? { max_tokens: Number(maxTokensEl.value) || undefined, temperature: Number(temperatureEl.value) || undefined }
    : classifyMessage(prompt);

  const payload = {
    model:                 modelEl.value.trim() || undefined,
    messages,
    chat_template_kwargs:  { enable_thinking: false },
    ...inferredParams,
  };

  const t0 = Date.now();
  let assistBody    = null;
  let fullText      = "";
  let reasoningText = "";
  let reasoningEl   = null;

  await streamCompletion(
    payload,
    (token) => {
      if (!assistBody) {
        thinking.remove();
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
      }
      fullText += token;
      assistBody.textContent = fullText;
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    },
    () => {
      if (!assistBody) thinking.remove();
      printChat(fullText || "—");
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      printMeta({ streamed: true, elapsed_s: Number(elapsed) });
      msgCount++;
      moodMsgTimestamps.push(Date.now());
      updateMood();
      syncDashboard();
      setStatus("ok", "Done");
      addActivity("chat", `Chat response received (${elapsed}s)`);
      const tokPerSec = document.getElementById("neuralTokens");
      if (tokPerSec && fullText) {
        const tps = (fullText.length / 4 / Number(elapsed)).toFixed(1);
        tokPerSec.textContent = tps;
      }
      if (fullText) showToast("Response received", "success");
      setTimeout(() => setStatus("idle", "Idle"), 2500);
      exitGeneratingState();
    },
    (err) => {
      thinking.remove();
      appendMessage("assist", `Error: ${err.message}`);
      printChat(err.message);
      setStatus("error", "Error");
      showToast(err.message, "error", 4000);
      setTimeout(() => setStatus("idle", "Idle"), 3500);
      exitGeneratingState();
    },
    (rToken) => {
      reasoningText += rToken;
      if (!reasoningEl) {
        const details  = document.createElement("details");
        details.className = "thinking-reasoning";
        const summary  = document.createElement("summary");
        summary.textContent = "Thinking…";
        const pre      = document.createElement("pre");
        pre.className  = "thinking-reasoning-text";
        details.appendChild(summary);
        details.appendChild(pre);
        const thinkBody = thinking.querySelector(".msg-body");
        if (thinkBody) { thinkBody.innerHTML = ""; thinkBody.appendChild(details); }
        reasoningEl = pre;
      }
      reasoningEl.textContent = reasoningText;
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    },
    currentAbortController.signal
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
  moodMsgTimestamps = [];
  updateMood();
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

  const searchParams = currentUser?.is_admin
    ? { max_tokens: Number(maxTokensEl.value) || undefined, temperature: 0.3 }
    : classifyMessage(query);

  const payload = {
    model:                modelEl.value.trim() || undefined,
    messages,
    chat_template_kwargs: { enable_thinking: false },
    ...searchParams,
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
      addActivity("search", "Knowledge search completed");
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
  showToast("Configuration applied", "success");
  addActivity("config", "Configuration updated");
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

// ── Auth overlay ──────────────────────────────────────
tabLoginEl.addEventListener("click", () => {
  tabLoginEl.classList.add("active");
  tabRegisterEl.classList.remove("active");
  loginFormEl.style.display    = "";
  registerFormEl.style.display = "none";
  authErrorEl.style.display    = "none";
});

tabRegisterEl.addEventListener("click", () => {
  tabRegisterEl.classList.add("active");
  tabLoginEl.classList.remove("active");
  registerFormEl.style.display = "";
  loginFormEl.style.display    = "none";
  authErrorEl.style.display    = "none";
});

function showAuthError(msg) {
  authErrorEl.textContent   = msg;
  authErrorEl.style.display = "block";
}

loginFormEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = loginUsernameEl.value.trim();
  const password = loginPasswordEl.value;
  if (!username || !password) { showAuthError("Fill in all fields."); return; }
  loginFormEl.querySelector("button[type=submit]").textContent = "Signing in…";
  try {
    const data = await callJson("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    await onLoginSuccess(data);
  } catch (err) {
    showAuthError(err.message.includes("401") ? "Invalid credentials." : err.message);
  } finally {
    loginFormEl.querySelector("button[type=submit]").textContent = "Sign In";
  }
});

registerFormEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = regUsernameEl.value.trim();
  const password = regPasswordEl.value;
  if (!username || !password) { showAuthError("Fill in all fields."); return; }
  if (password.length < 8)    { showAuthError("Password must be at least 8 characters."); return; }
  registerFormEl.querySelector("button[type=submit]").textContent = "Creating…";
  try {
    const data = await callJson("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    await onLoginSuccess(data);
  } catch (err) {
    showAuthError(err.message.includes("409") ? "Username already taken." : err.message);
  } finally {
    registerFormEl.querySelector("button[type=submit]").textContent = "Create Account";
  }
});

async function onLoginSuccess(data) {
  currentUser = { token: data.token, username: data.username, user_id: data.user_id, is_admin: !!data.is_admin };
  sessionStorage.setItem("sm_token",    data.token);
  sessionStorage.setItem("sm_username", data.username);
  sessionStorage.setItem("sm_user_id",  String(data.user_id));
  sessionStorage.setItem("sm_is_admin", data.is_admin ? "1" : "0");
  applyUserRole(!!data.is_admin);

  authOverlayEl.style.display = "none";
  profileDropdownEl.style.display = "";
  avatarLetterEl.textContent      = data.username.charAt(0).toUpperCase();
  profileMenuNameEl.textContent   = data.username;
  profileMenuRoleEl.textContent   = data.is_admin ? "admin" : "member";

  updateGreeting(data.username);
  addActivity("boot", `${data.username} signed in`);
  showToast(`Welcome, ${data.username}`, "success");
  await loadAndRenderHistory();
}

function restoreSession() {
  const token    = sessionStorage.getItem("sm_token");
  const username = sessionStorage.getItem("sm_username");
  const user_id  = sessionStorage.getItem("sm_user_id");
  const is_admin = sessionStorage.getItem("sm_is_admin") === "1";
  if (token && username && user_id) {
    currentUser = { token, username, user_id: Number(user_id), is_admin };
    authOverlayEl.style.display = "none";
    profileDropdownEl.style.display = "";
    avatarLetterEl.textContent      = username.charAt(0).toUpperCase();
    profileMenuNameEl.textContent   = username;
    profileMenuRoleEl.textContent   = is_admin ? "admin" : "member";
    applyUserRole(is_admin);
    updateGreeting(username);
    return true;
  }
  return false;
}

logoutBtnEl.addEventListener("click", async () => {
  try {
    await callJson("/auth/logout", { method: "POST", headers: getAuthHeaders(false) });
  } catch { /* ignore errors on logout */ }
  currentUser = null;
  sessionStorage.removeItem("sm_token");
  sessionStorage.removeItem("sm_username");
  sessionStorage.removeItem("sm_user_id");
  sessionStorage.removeItem("sm_is_admin");
  applyUserRole(false);
  authOverlayEl.style.display     = "";
  profileDropdownEl.style.display = "none";
  profileMenuEl.classList.remove("open");
  chatMessagesEl.innerHTML    = "";
  const empty = document.createElement("div");
  empty.className = "chat-empty"; empty.id = "chatEmpty";
  empty.innerHTML = `<div class="chat-empty-icon"><svg width="36" height="36" viewBox="0 0 36 36" fill="none"><path d="M32 4H4a2 2 0 00-2 2v18a2 2 0 002 2h6l4.5 5.5L19 26h13a2 2 0 002-2V6a2 2 0 00-2-2z" stroke="var(--accent)" stroke-width="1.4" stroke-linejoin="round"/><path d="M10 14h16M10 19h10" stroke="var(--accent)" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/></svg></div><p class="chat-empty-title">Start a conversation</p><p class="chat-empty-sub">Type below and press Enter or click Send</p>`;
  chatMessagesEl.appendChild(empty);
  msgCount = 0;
  syncDashboard();
  addActivity("boot", "User logged out");
  showToast("Logged out", "info");
});

// ── History ───────────────────────────────────────────
async function loadAndRenderHistory() {
  try {
    const data = await callJson("/v1/history", {
      method: "GET",
      headers: getAuthHeaders(false),
    });
    const msgs = [...data.messages].reverse();
    if (msgs.length === 0) return;
    document.getElementById("chatEmpty")?.remove();
    msgs.forEach(m => appendMessage(m.role === "assistant" ? "assist" : m.role, m.content));
    msgCount = msgs.filter(m => m.role === "user").length;
    syncDashboard();
    showToast(`Loaded ${msgs.length} history messages`, "info");
  } catch (err) {
    console.warn("History load failed:", err.message);
  }
}

// ── Init ──────────────────────────────────────────────
(async function init() {
  syncDashboard();
  if (restoreSession()) {
    await loadAndRenderHistory();
  }
})();