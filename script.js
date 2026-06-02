/**
 * LETTER PORTAL — script.js v2
 * ─────────────────────────────
 * Deep cinematic polish edition.
 * Handles: login flow, letter display, reply sending,
 * mascot animation, background effects, portal-close flow.
 */

/* ══════════════════════════════
   SHARED BACKGROUND FX
══════════════════════════════ */

function initStars() {
  const canvas = document.getElementById('starsCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];
  let W, H;

  function resize() {
    W = canvas.width = window.innerWidth;
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

  resize();
  draw();
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
      width:${size}px;
      height:${size}px;
      left:${Math.random() * 100}%;
      --dur:${10 + Math.random() * 14}s;
      --delay:${-Math.random() * 18}s;
      --dx:${(Math.random() - 0.5) * 90}px;
      opacity:0;
    `;
    wrap.appendChild(p);
  }
}

/* Intensify particles on success */
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
      bottom: 0;
      --dur:${4 + Math.random() * 4}s;
      --delay:${Math.random() * 0.5}s;
      --dx:${(Math.random() - 0.5) * 120}px;
      opacity:0;
      background: ${Math.random() > 0.5 ? 'var(--pink)' : 'var(--gold)'};
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

    // 1. Input glows
    input.classList.add('glow-success');

    // 2. Button goes loading
    btn.classList.add('loading');
    setFeedback('', 'success');

    // 3. Envelope success glow + flap opens
    await sleep(180);
    envelope.classList.add('success-glow');
    await sleep(250);
    envelope.classList.add('open');

    // 4. Ambient intensify + particle burst
    if (ambientGlow) ambientGlow.classList.add('intensify');
    burstParticles();

    // 5. Slight breathe, then portal
    await sleep(500);

    triggerPortalTransition(() => {
      sessionStorage.setItem('letterCode', code);
      // Mark as intentional navigation (not a refresh)
      sessionStorage.setItem('portalOpen', '1');
      window.location.href = 'letter.html';
    });
  }

  btn.addEventListener('click', openLetter);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') openLetter();
  });

  // Auto-focus on desktop
  if (window.innerWidth >= 600) {
    setTimeout(() => input.focus(), 600);
  }
}


/* ══════════════════════════════
   LETTER PAGE
══════════════════════════════ */

async function initLetterPage() {
  const letters = await loadLetters();

  const code = sessionStorage.getItem('letterCode');
  const portalOpen = sessionStorage.getItem('portalOpen');

  // ── PORTAL CLOSE FLOW ──
  // If no valid code OR no portal-open flag (direct nav / refresh), close cinematically
  if (!code || !letters[code] || !portalOpen) {
    sessionStorage.removeItem('letterCode');
    sessionStorage.removeItem('portalOpen');
    showPortalCloseAndRedirect();
    return;
  }

  // Clear the portal-open flag so refresh will trigger the close flow
  sessionStorage.removeItem('portalOpen');

  const data = letters[code];

  // ── Name ──
  const nameEl = document.getElementById('personName');
  nameEl.textContent = `Dear ${data.name}`;

  // ── Letter content with line-by-line reveal ──
  const contentEl = document.getElementById('letterContent');
  const lines = data.letter.trim().split('\n');
  lines.forEach((line, i) => {
    const p = document.createElement('p');
    p.classList.add('line');
    p.style.animationDelay = `${i * 0.11 + 0.4}s`;
    p.textContent = line; // empty lines become spacers via min-height in CSS
    contentEl.appendChild(p);
  });

  // ── Telegram config ──
  const TELEGRAM_BOT_TOKEN = '8807520611:AAHw3Up1WqiCCn94gC473fn03mt6rfCL66Q';
  const TELEGRAM_CHAT_ID   = '5399876396';

  const sendBtn    = document.getElementById('sendBtn');
  const replyInput = document.getElementById('replyInput');
  const statusText = document.getElementById('statusText');

  sendBtn.addEventListener('click', sendMessage);

  async function sendMessage() {
    const message = replyInput.value.trim();

    if (message.length < 2) {
      statusText.textContent = 'Write something first 🥲';
      return;
    }

    sendBtn.classList.add('sending');
    sendBtn.textContent = 'Sending... ✨';
    sendBtn.disabled = true;
    statusText.textContent = '';

    const finalMessage =
`✨ New Letter Reply
━━━━━━━━━━━━━━━━━━
🔐 Code: ${code}
👤 For: ${data.name}
🕒 Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
━━━━━━━━━━━━━━━━━━
💌 Message:
${message}`;

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

      if (result.ok) {
        statusText.textContent = 'Delivered safely ✨';
        sendBtn.classList.remove('sending');
        sendBtn.classList.add('sent');
        sendBtn.textContent = 'Sent ✓';
        replyInput.value = '';
        await sleep(300);
        showMascot(data.name);
      } else {
        throw new Error('not ok');
      }

    } catch (err) {
      statusText.textContent = 'Something went wrong, try again 🥲';
      sendBtn.classList.remove('sending');
      sendBtn.textContent = 'Send Message ✨';
      sendBtn.disabled = false;
    }
  }
}


/* ══════════════════════════════
   PORTAL CLOSE ANIMATION
   (cinematic refresh / redirect)
══════════════════════════════ */

function showPortalCloseAndRedirect() {
  // Hide the main letter page content if any
  const letterPage = document.querySelector('.letter-page');
  if (letterPage) letterPage.style.opacity = '0';

  const overlay = document.getElementById('portalCloseOverlay');
  if (!overlay) {
    window.location.href = 'index.html';
    return;
  }

  overlay.classList.add('active');

  // After the cinematic moment, redirect
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 2200);
}


/* ══════════════════════════════
   MASCOT ANIMATION
══════════════════════════════ */

function showMascot(recipientName) {
  const scene      = document.getElementById('mascotScene');
  const deliveryTxt= document.getElementById('deliveryText');

  if (!scene) return;

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

  deliveryTxt.textContent = `Message safely delivered ✨`;

  scene.classList.remove('hidden');

  // Reset animations by cloning
  ['mascotChar', 'mascotLetter'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
  });

  setTimeout(() => {
    scene.classList.add('hidden');
  }, 7800);
}


/* ══════════════════════════════
   UTILITY
══════════════════════════════ */

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getPage() {
  return window.location.pathname.split('/').pop().toLowerCase() || 'index.html';
}


/* ══════════════════════════════
   INIT
══════════════════════════════ */

window.addEventListener('DOMContentLoaded', () => {
  initStars();
  initParticles();

  const page = getPage();

  if (page === 'index.html' || page === '') {
    initLoginPage();
  } else if (page === 'letter.html') {
    initLetterPage();
  }
});