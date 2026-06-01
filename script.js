/**
 * LETTER PORTAL — script.js
 * ─────────────────────────
 * Handles: login flow, letter display, reply sending,
 * mascot animation, background effects.
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
    stars = Array.from({ length: 130 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.3 + 0.2,
      a: Math.random(),
      speed: Math.random() * 0.4 + 0.1,
      twinkle: Math.random() * Math.PI * 2,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const now = Date.now() / 1000;
    stars.forEach(s => {
      s.y -= s.speed * 0.15;
      if (s.y < -2) s.y = H + 2;
      const alpha = s.a * (0.5 + 0.5 * Math.sin(now * 1.2 + s.twinkle));
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
  const count = window.innerWidth < 600 ? 10 : 18;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 3 + 1.5;
    p.style.cssText = `
      width:${size}px;
      height:${size}px;
      left:${Math.random() * 100}%;
      --dur:${10 + Math.random() * 12}s;
      --delay:${-Math.random() * 15}s;
      --dx:${(Math.random() - 0.5) * 80}px;
      opacity:0;
    `;
    wrap.appendChild(p);
  }
}


/* ══════════════════════════════
   LOGIN PAGE
══════════════════════════════ */

async function initLoginPage() {
  const letters = await loadLetters();

  const input      = document.getElementById('secretCode');
  const btn        = document.getElementById('openBtn');
  const feedback   = document.getElementById('feedbackText');
  const errorMascot= document.getElementById('errorMascot');
  const envelope   = document.getElementById('envelope');
  const overlay    = document.getElementById('portalOverlay');

  function setFeedback(msg, type = 'error') {
    feedback.textContent = msg;
    feedback.style.color = type === 'success' ? '#a3f0c0' : 'var(--pink)';
  }

  function showError(msg) {
    setFeedback(msg, 'error');

    // Shake input
    input.classList.remove('shake');
    void input.offsetWidth; // reflow
    input.classList.add('shake');
    input.addEventListener('animationend', () => input.classList.remove('shake'), { once: true });

    // Envelope react
    envelope.classList.remove('error-glow');
    void envelope.offsetWidth;
    envelope.classList.add('error-glow');
    setTimeout(() => envelope.classList.remove('error-glow'), 1200);

    // Error mascot
    errorMascot.classList.add('visible');
    setTimeout(() => errorMascot.classList.remove('visible'), 3000);
  }

  function triggerPortalTransition(callback) {
    overlay.classList.add('active');
    setTimeout(callback, 850);
  }

  async function openLetter() {
    const code = input.value.trim();

    if (!letters[code]) {
      showError("this letter is not yours 👀");
      return;
    }

    // Success state
    btn.classList.add('loading');
    setFeedback('', 'success');
    envelope.classList.add('success-glow');
    envelope.classList.add('open'); // flap opens

    // Slight delay, then portal
    await sleep(600);

    triggerPortalTransition(() => {
      sessionStorage.setItem('letterCode', code);
      window.location.href = 'letter.html';
    });
  }

  btn.addEventListener('click', openLetter);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') openLetter();
  });
}


/* ══════════════════════════════
   LETTER PAGE
══════════════════════════════ */

async function initLetterPage() {
  const letters = await loadLetters();

  const code = sessionStorage.getItem('letterCode');
  if (!code || !letters[code]) {
    window.location.href = 'index.html';
    return;
  }

  const data = letters[code];

  // Name
  const nameEl = document.getElementById('personName');
  nameEl.textContent = `Dear ${data.name}`;

  // Letter lines
  const contentEl = document.getElementById('letterContent');
  const lines = data.letter.trim().split('\n');
  lines.forEach((line, i) => {
    const p = document.createElement('p');
    p.classList.add('line');
    p.style.animationDelay = `${i * 0.13 + 0.3}s`;
    p.textContent = line;
    contentEl.appendChild(p);
  });

  // Telegram config — replace with your real token
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

    // Sending state
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
   MASCOT ANIMATION
══════════════════════════════ */

function showMascot(recipientName) {
  const scene      = document.getElementById('mascotScene');
  const deliveryTxt= document.getElementById('deliveryText');

  if (!scene) return;

  // Populate twinkling stars
  const starsWrap = document.getElementById('mascotStars');
  if (starsWrap) {
    starsWrap.innerHTML = '';
    const positions = [
      [15,20],[30,10],[55,15],[70,8],[85,18],
      [10,40],[42,35],[68,30],[90,25],[25,55],
      [60,50],[78,45],[20,70],[50,65],[80,60]
    ];
    positions.forEach(([left, top], i) => {
      const star = document.createElement('div');
      star.className = 'mascot-star';
      star.textContent = '✦';
      star.style.cssText = `
        left:${left}%; top:${top}%;
        animation-delay:${i * 0.18}s;
        font-size:${0.7 + Math.random() * 0.6}rem;
      `;
      starsWrap.appendChild(star);
    });
  }

  deliveryTxt.textContent = `Message safely delivered ✨`;

  scene.classList.remove('hidden');

  // Reset char/letter animation by cloning
  ['mascotChar', 'mascotLetter'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
  });

  // Hide after 7.5s
  setTimeout(() => {
    scene.classList.add('hidden');
  }, 7500);
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