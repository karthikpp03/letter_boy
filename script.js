/**
 * LETTER PORTAL — script.js v3
 * ─────────────────────────────────
 * Full state machine edition.
 * - Memory states: active → opened → faded → reopen_requested → reopened_once → expired
 * - One-time read logic with localStorage persistence
 * - Reopen request system (Telegram notification)
 * - Edge case handling (refresh before/after comment)
 * - Admin route support
 * - Existing UI/animations preserved completely
 */

/* ══════════════════════════════
   CONFIG
══════════════════════════════ */

const WORKER_URL = 'https://letterboy-api.zeus-karthik11.workers.dev';
const TELEGRAM_BOT_TOKEN = '8807520611:AAHw3Up1WqiCCn94gC473fn03mt6rfCL66Q';
const TELEGRAM_CHAT_ID   = '5399876396';

/* ══════════════════════════════
   LOCAL STATE HELPERS
   Persists memory state per-code in localStorage.
   Server (Worker) is the source of truth for state;
   localStorage is a client-side cache / guard.
══════════════════════════════ */

const LS_PREFIX = 'lp_';

function lsKey(code) { return LS_PREFIX + code; }

function getLocalState(code) {
  try {
    const raw = localStorage.getItem(lsKey(code));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setLocalState(code, obj) {
  try {
    localStorage.setItem(lsKey(code), JSON.stringify(obj));
  } catch {}
}

function mergeLocalState(code, patch) {
  const existing = getLocalState(code) || {};
  setLocalState(code, { ...existing, ...patch });
}

/* ══════════════════════════════
   SHARED BACKGROUND FX  (unchanged)
══════════════════════════════ */

function initStars() {
  const canvas = document.getElementById('starsCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [], W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    stars = Array.from({ length: 150 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.4 + 0.2,
      a: Math.random(),
      speed: Math.random() * 0.35 + 0.08,
      twinkle: Math.random() * Math.PI * 2,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const now = Date.now() / 1000;
    stars.forEach(s => {
      s.y -= s.speed * 0.12;
      if (s.y < -2) { s.y = H + 2; s.x = Math.random() * W; }
      const alpha = s.a * (0.45 + 0.55 * Math.sin(now * 1.1 + s.twinkle));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  resize(); draw();
  window.addEventListener('resize', resize);
}

function initParticles() {
  const wrap = document.getElementById('particlesWrap');
  if (!wrap) return;
  const count = window.innerWidth < 600 ? 12 : 20;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle' + (Math.random() > 0.85 ? ' gold' : '');
    const size = Math.random() * 3 + 1.5;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      --dur:${10 + Math.random() * 14}s;
      --delay:${-Math.random() * 18}s;
      --dx:${(Math.random() - 0.5) * 90}px;
      opacity:0;
    `;
    wrap.appendChild(p);
  }
}

function burstParticles() {
  const wrap = document.getElementById('particlesWrap');
  if (!wrap) return;
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 2;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${35 + Math.random() * 30}%;
      bottom:0;
      --dur:${4 + Math.random() * 4}s;
      --delay:${Math.random() * 0.5}s;
      --dx:${(Math.random() - 0.5) * 120}px;
      opacity:0;
      background:${Math.random() > 0.5 ? 'var(--pink)' : 'var(--gold)'};
    `;
    wrap.appendChild(p);
    setTimeout(() => p.remove(), 8000);
  }
}


/* ══════════════════════════════
   LOGIN PAGE
══════════════════════════════ */

async function initLoginPage() {
  const letters = await loadLetters();

  const input       = document.getElementById('secretCode');
  const btn         = document.getElementById('openBtn');
  const feedback    = document.getElementById('feedbackText');
  const errorMascot = document.getElementById('errorMascot');
  const envelope    = document.getElementById('envelope');
  const overlay     = document.getElementById('portalOverlay');
  const ambientGlow = document.getElementById('ambientGlow');

  // Pre-fill code from URL if present: /letter/728194 or ?code=728194
  const urlCode = getCodeFromURL();
  if (urlCode && input) {
    input.value = urlCode;
    // Brief delay so user sees it filled, then auto-open
    setTimeout(openLetter, 400);
  }

  function setFeedback(msg, type = 'error') {
    feedback.textContent = msg;
    feedback.style.color = type === 'success' ? '#a3f0c0' : 'var(--pink)';
  }

  function showError(msg) {
    setFeedback(msg, 'error');
    input.classList.remove('shake');
    void input.offsetWidth;
    input.classList.add('shake');
    input.addEventListener('animationend', () => input.classList.remove('shake'), { once: true });
    envelope.classList.remove('error-glow');
    void envelope.offsetWidth;
    envelope.classList.add('error-glow');
    setTimeout(() => envelope.classList.remove('error-glow'), 1200);
    errorMascot.classList.add('visible');
    setTimeout(() => errorMascot.classList.remove('visible'), 3200);
  }

  function triggerPortalTransition(callback) {
    overlay.classList.add('active');
    setTimeout(callback, 950);
  }

  async function openLetter() {
    const code = input.value.trim();

    if (!letters[code]) {
      showError("this letter is not yours 👀");
      return;
    }

    // Always fetch live state from Worker — never trust stale local cache for gating
    // This ensures REOPEN:code from admin instantly unblocks the user
    btn.classList.add('loading');
    const liveState = await fetchLiveState(code);
    const effectiveState = liveState || letters[code].state || 'active';

    // Sync local state to match server (clear stale faded if server says reopened_once)
    const READABLE_STATES = ['active', 'reopened_once'];
    if (READABLE_STATES.includes(effectiveState)) {
      // Server says readable — clear any stale local faded state
      const local = getLocalState(code) || {};
      if (local.state && !READABLE_STATES.includes(local.state)) {
        mergeLocalState(code, { state: effectiveState });
      }
    }

    // If expired (permanently locked after reopen read)
    if (effectiveState === 'expired') {
      btn.classList.remove('loading');
      showError("this memory has faded forever 🌙");
      return;
    }

    // If faded — show reopen screen instead of letter
    if (effectiveState === 'faded') {
      input.classList.add('glow-success');
      await sleep(300);
      triggerPortalTransition(() => {
        sessionStorage.setItem('letterCode', code);
        sessionStorage.setItem('portalOpen', '1');
        sessionStorage.setItem('memoryFaded', '1');
        sessionStorage.setItem('liveLetterState', effectiveState);
        window.location.href = 'letter.html';
      });
      return;
    }

    // If reopen_requested — still show faded screen (pending admin approval)
    if (effectiveState === 'reopen_requested') {
      btn.classList.remove('loading');
      showError("reopen request pending... 🌙");
      return;
    }

    // Normal open flow (active or reopened_once)
    input.classList.add('glow-success');
    setFeedback('', 'success');

    await sleep(180);
    envelope.classList.add('success-glow');
    await sleep(250);
    envelope.classList.add('open');

    if (ambientGlow) ambientGlow.classList.add('intensify');
    burstParticles();
    await sleep(500);

    triggerPortalTransition(() => {
      sessionStorage.setItem('letterCode', code);
      sessionStorage.setItem('portalOpen', '1');
      sessionStorage.setItem('liveLetterState', effectiveState);
      sessionStorage.removeItem('memoryFaded');

      // Fire-and-forget: notify that letter has been successfully opened
      fetch(`${WORKER_URL}/opened`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name: letters[code].name })
      }).catch(() => {});

      window.location.href = 'letter.html';
    });
  }

  btn.addEventListener('click', openLetter);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') openLetter();
  });

  if (window.innerWidth >= 600) {
    setTimeout(() => input.focus(), 600);
  }
}


/* ══════════════════════════════
   LETTER PAGE
══════════════════════════════ */

async function initLetterPage() {
  const letters = await loadLetters();

  const code          = sessionStorage.getItem('letterCode');
  const portalOpen    = sessionStorage.getItem('portalOpen');
  const memoryFaded   = sessionStorage.getItem('memoryFaded');
  // liveLetterState was set by the login page after fresh Worker fetch
  const liveState     = sessionStorage.getItem('liveLetterState');

  // No valid portal entry
  if (!code || !letters[code] || !portalOpen) {
    sessionStorage.removeItem('letterCode');
    sessionStorage.removeItem('portalOpen');
    sessionStorage.removeItem('memoryFaded');
    sessionStorage.removeItem('liveLetterState');
    showPortalCloseAndRedirect();
    return;
  }

  // Clear portal open flag (so refresh triggers close)
  sessionStorage.removeItem('portalOpen');

  // ── FADED / REOPEN SCREEN ──
  if (memoryFaded === '1') {
    sessionStorage.removeItem('memoryFaded');
    const data = letters[code];
    // Use live state passed from login page, not stale localStorage
    showReopenScreen(code, data, liveState || 'faded');
    return;
  }

  const data = letters[code];

  // Use live state (freshly fetched by login page) — fall back to json then local
  const localState     = getLocalState(code) || {};
  const READABLE_STATES = ['active', 'reopened_once'];
  // liveState from session is authoritative; only fall back if absent
  const effectiveState = liveState || localState.state || data.state || 'active';

  // If not readable — show reopen screen
  if (!READABLE_STATES.includes(effectiveState)) {
    showReopenScreen(code, data, effectiveState);
    return;
  }

  // ── NORMAL LETTER DISPLAY ──
  renderLetter(code, data, effectiveState);
}


function renderLetter(code, data, state) {
  const nameEl    = document.getElementById('personName');
  const contentEl = document.getElementById('letterContent');

  nameEl.textContent = `Dear ${data.name}`;

  const lines = data.letter.trim().split('\n');
  lines.forEach((line, i) => {
    const p = document.createElement('p');
    p.classList.add('line');
    p.style.animationDelay = `${i * 0.11 + 0.4}s`;
    p.textContent = line;
    contentEl.appendChild(p);
  });

  // ── Reply section ──
  const sendBtn    = document.getElementById('sendBtn');
  const replyInput = document.getElementById('replyInput');
  const statusText = document.getElementById('statusText');

  // Check if comment already submitted this session
  const localState = getLocalState(code) || {};
  if (localState.commentSent && localState.state === 'faded') {
    // Already faded — disable send, show message
    sendBtn.disabled = true;
    sendBtn.textContent = 'Memory faded ✨';
    sendBtn.classList.add('sent');
    statusText.textContent = 'This memory has been safely carried away.';
    return;
  }

  sendBtn.addEventListener('click', () => sendMessage(code, data, state));
}


async function sendMessage(code, data, state) {
  const replyInput = document.getElementById('replyInput');
  const sendBtn    = document.getElementById('sendBtn');
  const statusText = document.getElementById('statusText');

  const message = replyInput.value.trim();
  if (message.length < 2) {
    statusText.textContent = 'Write something first 🥲';
    return;
  }

  sendBtn.classList.add('sending');
  sendBtn.textContent = 'Sending... ✨';
  sendBtn.disabled = true;
  statusText.textContent = '';

  // Determine if this is a reopened read — use live session state, not stale localStorage
  const sessionState = sessionStorage.getItem('liveLetterState') || '';
  const localState   = getLocalState(code) || {};
  const isReopen     = sessionState === 'reopened_once'
                    || localState.state === 'reopened_once'
                    || data.state === 'reopened_once'
                    || state === 'reopened_once';
  const nextState  = isReopen ? 'expired' : 'faded';
  const stateLabel = isReopen ? '🔒 Final Read' : '💌 New Reply';

  const finalMessage =
`✨ ${stateLabel}
━━━━━━━━━━━━━━━━━━
🔐 Code: ${code}
👤 For: ${data.name}
🕒 Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
📊 State: ${state} → ${nextState}
━━━━━━━━━━━━━━━━━━
💌 Message:
${message}`;

  let success = false;

  // Try Worker first (updates state on GitHub too)
  try {
    const res = await fetch(`${WORKER_URL}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: data.name, message, nextState })
    });
    if (res.ok) success = true;
  } catch (_) {}

  // Fallback: direct Telegram
  if (!success) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: finalMessage,
            parse_mode: 'HTML'
          })
        }
      );
      const result = await res.json();
      if (result.ok) success = true;
    } catch (_) {}
  }

  if (success) {
    // Persist faded state locally immediately
    mergeLocalState(code, {
      state: nextState,
      commentSent: true,
      fadedAt: Date.now()
    });

    statusText.textContent = 'Delivered safely ✨';
    sendBtn.classList.remove('sending');
    sendBtn.classList.add('sent');
    sendBtn.textContent = 'Sent ✓';
    replyInput.value = '';

    await sleep(300);
    showMascot(data.name, () => {
      // After mascot: trigger fade animation then lock
      triggerMemoryFade(code, nextState);
    });
  } else {
    statusText.textContent = 'Something went wrong, try again 🥲';
    sendBtn.classList.remove('sending');
    sendBtn.textContent = 'Send Message ✨';
    sendBtn.disabled = false;
  }
}


/* Memory fade — cinematic lock sequence after comment sent */
function triggerMemoryFade(code, nextState) {
  const paper = document.getElementById('paper');
  if (paper) {
    paper.classList.add('fading-memory');
    setTimeout(() => {
      paper.classList.add('faded-memory');
    }, 1200);
  }

  // After fade, redirect back to index (memory locked)
  setTimeout(() => {
    sessionStorage.removeItem('letterCode');
    showPortalCloseAndRedirect();
  }, 4500);
}


/* ══════════════════════════════
   REOPEN SCREEN
   Shown when a faded memory is accessed again.
   Renders as a full dark overlay — not inside .paper
   (paper has cream bg + dark ink which hides text).
══════════════════════════════ */

function showReopenScreen(code, data, explicitState) {
  // Hide paper and letter page — reopen screen is its own world
  const paper      = document.getElementById('paper');
  const letterPage = document.querySelector('.letter-page');
  if (paper)      paper.style.display = 'none';
  if (letterPage) letterPage.style.opacity = '0';

  // State priority: explicit (from live Worker fetch) > local cache > data field
  const localState = getLocalState(code) || {};
  const state      = explicitState || localState.state || data.state || 'faded';
  const isExpired  = state === 'expired';
  const isPending  = state === 'reopen_requested';

  // Build full-screen overlay
  const overlay = document.createElement('div');
  overlay.id = 'reopenOverlay';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:1000',
    'display:flex', 'align-items:center', 'justify-content:center',
    'padding:24px', 'opacity:0', 'transition:opacity 0.6s ease'
  ].join(';');

  const card = document.createElement('div');
  card.className = 'reopen-card';

  // Build inner HTML
  let inner = `<div class="reopen-icon">${isExpired ? '🔒' : isPending ? '🌙' : '🌫️'}</div>`;
  inner += `<h1 class="reopen-title">${
    isExpired ? 'This memory has faded forever'
    : isPending ? 'Reopen request sent...'
    : 'This memory has faded'
  }</h1>`;
  inner += `<p class="reopen-sub">${
    isExpired
      ? 'Some memories are meant to be carried, not revisited.'
      : isPending
      ? 'Waiting for a quiet moment to reopen 🌙'
      : 'You already read this once and left something behind.<br>The memory has been carried away.'
  }</p>`;
  if (!isExpired && !isPending) {
    inner += `<button class="reopen-btn" id="reopenBtn">Request Reopen 🌙</button>`;
    inner += `<p class="reopen-status" id="reopenStatus"></p>`;
  }
  inner += `<a href="index.html" class="reopen-back">← back to portal</a>`;
  card.innerHTML = inner;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Fade in after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
  });

  // Attach button listener AFTER element is in DOM
  if (!isExpired && !isPending) {
    const reopenBtn    = document.getElementById('reopenBtn');
    const reopenStatus = document.getElementById('reopenStatus');
    if (reopenBtn) {
      reopenBtn.addEventListener('click', () => {
        sendReopenRequest(code, data, reopenBtn, reopenStatus);
      });
    }
  }
}


async function sendReopenRequest(code, data, btn, statusEl) {
  btn.disabled = true;
  btn.textContent = 'Sending request... 🌙';

  const message =
`🌙 Reopen Request
━━━━━━━━━━━━━━━━━━
🔐 Code: ${code}
👤 For: ${data.name}
🕒 Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
━━━━━━━━━━━━━━━━━━
They're asking to reopen their memory once.

Reply with: REOPEN:${code}`;

  let sent = false;

  // Try Worker
  try {
    const res = await fetch(`${WORKER_URL}/reopen-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: data.name })
    });
    if (res.ok) sent = true;
  } catch (_) {}

  // Fallback: direct Telegram
  if (!sent) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
          })
        }
      );
      const result = await res.json();
      if (result.ok) sent = true;
    } catch (_) {}
  }

  if (sent) {
    mergeLocalState(code, { state: 'reopen_requested', requestedAt: Date.now() });
    btn.textContent = 'Request sent 🌙';
    btn.classList.add('sent');
    statusEl.textContent = 'Someone will read this and decide quietly.';

    // Gentle shimmer animation on success
    btn.style.animation = 'reopenGlow 1.8s ease infinite';
  } else {
    btn.disabled = false;
    btn.textContent = 'Request Reopen 🌙';
    statusEl.textContent = 'Something went wrong. Try again 🥲';
  }
}


/* ══════════════════════════════
   PORTAL CLOSE ANIMATION  (unchanged)
══════════════════════════════ */

function showPortalCloseAndRedirect() {
  const letterPage = document.querySelector('.letter-page');
  if (letterPage) letterPage.style.opacity = '0';

  const overlay = document.getElementById('portalCloseOverlay');
  if (!overlay) {
    window.location.href = 'index.html';
    return;
  }

  overlay.classList.add('active');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 2200);
}


/* ══════════════════════════════
   MASCOT ANIMATION  (unchanged, now with callback)
══════════════════════════════ */

function showMascot(recipientName, onComplete) {
  const scene       = document.getElementById('mascotScene');
  const deliveryTxt = document.getElementById('deliveryText');

  if (!scene) {
    if (onComplete) setTimeout(onComplete, 500);
    return;
  }

  const starsWrap = document.getElementById('mascotStars');
  if (starsWrap) {
    starsWrap.innerHTML = '';
    const positions = [
      [15,20],[30,10],[55,15],[70,8],[85,18],
      [10,40],[42,35],[68,30],[90,25],[25,55],
      [60,50],[78,45],[20,70],[50,65],[80,60],
      [38,25],[65,18],[48,42]
    ];
    positions.forEach(([left, top], i) => {
      const star = document.createElement('div');
      star.className = 'mascot-star';
      star.textContent = ['✦','✧','⋆','·'][i % 4];
      star.style.cssText = `
        left:${left}%; top:${top}%;
        animation-delay:${i * 0.16}s;
        font-size:${0.6 + Math.random() * 0.7}rem;
      `;
      starsWrap.appendChild(star);
    });
  }

  deliveryTxt.textContent = 'Message safely delivered ✨';
  scene.classList.remove('hidden');

  ['mascotChar', 'mascotLetter'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
  });

  setTimeout(() => {
    scene.classList.add('hidden');
    if (onComplete) onComplete();
  }, 7800);
}


/* ══════════════════════════════
   URL CODE EXTRACTION
   Handles /letter/728194 and ?code=728194
══════════════════════════════ */

function getCodeFromURL() {
  // Path: /letter/728194
  const pathMatch = window.location.pathname.match(/\/letter\/(\d+)/);
  if (pathMatch) return pathMatch[1];

  // Query: ?code=728194
  const params = new URLSearchParams(window.location.search);
  if (params.get('code')) return params.get('code');

  return null;
}


/* ══════════════════════════════
   RIGHT-CLICK GENTLE PROTECTION
══════════════════════════════ */

function initGentleProtection() {
  document.addEventListener('contextmenu', e => {
    e.preventDefault();
    // Soft emotional whisper instead of hard block
    const whisper = document.createElement('div');
    whisper.className = 'protection-whisper';
    whisper.textContent = 'some things are meant to just be felt ✨';
    whisper.style.cssText = `
      position:fixed;
      left:50%; top:50%;
      transform:translate(-50%,-50%);
      background:rgba(8,8,16,0.92);
      color:rgba(255,179,207,0.85);
      font-family:'Lora',serif;
      font-style:italic;
      font-size:0.95rem;
      padding:14px 22px;
      border-radius:12px;
      border:1px solid rgba(255,179,207,0.15);
      pointer-events:none;
      z-index:99999;
      opacity:0;
      transition:opacity 0.4s ease;
      text-align:center;
    `;
    document.body.appendChild(whisper);
    requestAnimationFrame(() => { whisper.style.opacity = '1'; });
    setTimeout(() => {
      whisper.style.opacity = '0';
      setTimeout(() => whisper.remove(), 500);
    }, 2200);
  });
}


/* ══════════════════════════════
   LIVE STATE FETCH
   Always hits Worker for fresh state — bypasses all caches.
   Falls back to null on any error (caller uses json state).
══════════════════════════════ */

async function fetchLiveState(code) {
  try {
    const res = await fetch(
      `${WORKER_URL}/status/${code}?t=${Date.now()}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.state || null;
  } catch {
    return null;
  }
}


/* ══════════════════════════════
   UTILITY
══════════════════════════════ */

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getPage() {
  const path = window.location.pathname;
  // Handle /letter/728194 → index page with code
  if (path.match(/\/letter\//)) return 'index.html';
  return path.split('/').pop().toLowerCase() || 'index.html';
}


/* ══════════════════════════════
   INIT
══════════════════════════════ */

window.addEventListener('DOMContentLoaded', () => {
  initStars();
  initParticles();
  initGentleProtection();

  const page = getPage();

  if (page === 'index.html' || page === '') {
    initLoginPage();
  } else if (page === 'letter.html') {
    initLetterPage();
  }
});
