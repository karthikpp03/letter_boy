/**
 * LETTER PORTAL — Cloudflare Worker
 * letterboy-api.zeus-karthik11.workers.dev
 *
 * Routes:
 *   POST /webhook          — Telegram webhook receiver
 *   POST /comment          — Comment + state update from frontend
 *   POST /reopen-request   — Reopen request from frontend
 *   GET  /status/:code     — Letter state query
 *   GET  /admin/letters    — All letters (admin panel)
 *   POST /admin/update     — Admin action (reopen/lock/etc)
 *
 * Secrets (set via wrangler secret put):
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID
 *   GITHUB_TOKEN
 *   GITHUB_REPO      (e.g. "karthikpp03/letter_boy")
 *   GITHUB_FILE_PATH (e.g. "letters.json")
 *   ADMIN_KEY        (simple admin key, e.g. "moon2024")
 */

const ALLOWED_ORIGINS = [
  'https://letterboy.netlify.app',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
];

export default {
  async fetch(request, env) {
    // CORS
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ── Telegram Webhook ──
      if (path === '/webhook' && request.method === 'POST') {
        return await handleWebhook(request, env, corsHeaders);
      }

      // ── Frontend: comment submitted ──
      if (path === '/comment' && request.method === 'POST') {
        return await handleComment(request, env, corsHeaders);
      }

      // ── Frontend: reopen request ──
      if (path === '/reopen-request' && request.method === 'POST') {
        return await handleReopenRequest(request, env, corsHeaders);
      }

      // ── Status check ──
      if (path.startsWith('/status/') && request.method === 'GET') {
        const code = path.split('/status/')[1];
        return await handleStatus(code, env, corsHeaders);
      }

      // ── Admin: list all letters ──
      if (path === '/admin/letters' && request.method === 'GET') {
        if (!checkAdminKey(request, env)) {
          return json({ error: 'unauthorized' }, 401, corsHeaders);
        }
        return await handleAdminList(env, corsHeaders);
      }

      // ── Admin: update a letter ──
      if (path === '/admin/update' && request.method === 'POST') {
        if (!checkAdminKey(request, env)) {
          return json({ error: 'unauthorized' }, 401, corsHeaders);
        }
        return await handleAdminUpdate(request, env, corsHeaders);
      }

      return json({ error: 'not found' }, 404, corsHeaders);

    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: 'internal error', detail: err.message }, 500, corsHeaders);
    }
  }
};


/* ══════════════════════════════
   TELEGRAM WEBHOOK HANDLER
   Receives messages from admin Telegram bot.
   Parses commands and updates letters.json on GitHub.
══════════════════════════════ */

async function handleWebhook(request, env, cors) {
  const body = await request.json();

  const message = body?.message;
  if (!message?.text) {
    return json({ ok: true }, 200, cors);
  }

  const chatId  = String(message.chat?.id);
  const allowed = String(env.TELEGRAM_CHAT_ID);

  // Only process messages from admin chat
  if (chatId !== allowed) {
    return json({ ok: true }, 200, cors);
  }

  const text = message.text.trim();
  const result = await parseAndExecuteCommand(text, env);

  // Reply to admin
  if (result.reply) {
    await sendTelegram(env, result.reply);
  }

  return json({ ok: true }, 200, cors);
}


/* ══════════════════════════════
   COMMAND PARSER
   Handles:
     CREATE LETTER
     CODE:728194
     NAME:Aishu
     THEME:moonlight
     LETTER:
     multiline...

     REOPEN:728194
     LOCK:728194
     STATUS:728194
══════════════════════════════ */

async function parseAndExecuteCommand(text, env) {
  // ── SINGLE-LINE COMMANDS ──
  const reopenMatch = text.match(/^REOPEN:(\d+)\s*$/i);
  if (reopenMatch) {
    const code = reopenMatch[1];
    const ok = await updateLetterState(code, 'reopened_once', env);
    return {
      reply: ok
        ? `✅ REOPEN approved for ${code}. They get one more read.`
        : `❌ Failed to update ${code}. Check GitHub token/repo.`
    };
  }

  const lockMatch = text.match(/^LOCK:(\d+)\s*$/i);
  if (lockMatch) {
    const code = lockMatch[1];
    const ok = await updateLetterState(code, 'expired', env);
    return {
      reply: ok
        ? `🔒 LOCKED ${code} permanently.`
        : `❌ Failed to lock ${code}.`
    };
  }

  const statusMatch = text.match(/^STATUS:(\d+)\s*$/i);
  if (statusMatch) {
    const code = statusMatch[1];
    const letters = await fetchLettersJSON(env);
    const letter  = letters?.[code];
    if (!letter) return { reply: `❓ Code ${code} not found.` };
    return {
      reply: `📊 ${code} — ${letter.name}\nState: ${letter.state || 'active'}\nReopens: ${letter.reopen_count || 0}`
    };
  }

  // ── CREATE LETTER (multiline block) ──
  if (/^CREATE\s+LETTER/i.test(text)) {
    return await parseCreateLetter(text, env);
  }

  return { reply: null };
}


async function parseCreateLetter(text, env) {
  // Parse block format:
  //   CREATE LETTER
  //   CODE:728194
  //   NAME:Aishu
  //   THEME:moonlight
  //   LETTER:
  //   multiline letter content...

  const lines = text.split('\n');
  let code = '', name = '', theme = 'default', letterLines = [];
  let inLetterBlock = false;

  for (let i = 1; i < lines.length; i++) { // skip "CREATE LETTER" line
    const line = lines[i];
    const trimmed = line.trim();

    if (inLetterBlock) {
      letterLines.push(line);
      continue;
    }

    const codeMatch  = trimmed.match(/^CODE:(.+)$/i);
    const nameMatch  = trimmed.match(/^NAME:(.+)$/i);
    const themeMatch = trimmed.match(/^THEME:(.+)$/i);

    if (codeMatch)  { code  = codeMatch[1].trim();  continue; }
    if (nameMatch)  { name  = nameMatch[1].trim();  continue; }
    if (themeMatch) { theme = themeMatch[1].trim(); continue; }
    if (/^LETTER:\s*$/i.test(trimmed)) { inLetterBlock = true; continue; }
  }

  // Validate
  if (!code || !name || letterLines.length === 0) {
    return {
      reply: `❌ Invalid CREATE LETTER format.\n\nExpected:\nCREATE LETTER\nCODE:728194\nNAME:Aishu\nTHEME:moonlight\nLETTER:\nyour letter here...`
    };
  }

  // Trim trailing blank lines from letter
  while (letterLines.length > 0 && letterLines[letterLines.length - 1].trim() === '') {
    letterLines.pop();
  }

  const letterText = letterLines.join('\n');

  // Upsert into letters.json
  const ok = await upsertLetter(code, { name, theme, state: 'active', reopen_count: 0, letter: letterText }, env);

  return {
    reply: ok
      ? `✅ Letter created!\nCode: ${code}\nName: ${name}\nTheme: ${theme}\nLines: ${letterLines.length}`
      : `❌ Failed to create letter. Check GitHub token/repo.`
  };
}


/* ══════════════════════════════
   COMMENT HANDLER
   Called by frontend after successful comment send.
   Updates state in letters.json.
══════════════════════════════ */

async function handleComment(request, env, cors) {
  const { code, name, message, nextState } = await request.json();

  if (!code || !message) {
    return json({ error: 'missing fields' }, 400, cors);
  }

  // Send to Telegram
  const stateLabel = nextState === 'expired' ? '🔒 Final Read' : '💌 New Reply';
  const tgMsg =
`✨ ${stateLabel}
━━━━━━━━━━━━━━━━━━
🔐 Code: ${code}
👤 For: ${name}
🕒 Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
📊 → ${nextState}
━━━━━━━━━━━━━━━━━━
💌 Message:
${message}`;

  await sendTelegram(env, tgMsg);

  // Update state in GitHub
  const validStates = ['faded', 'expired'];
  if (validStates.includes(nextState)) {
    await updateLetterState(code, nextState, env);
  }

  return json({ ok: true }, 200, cors);
}


/* ══════════════════════════════
   REOPEN REQUEST HANDLER
══════════════════════════════ */

async function handleReopenRequest(request, env, cors) {
  const { code, name } = await request.json();

  if (!code) return json({ error: 'missing code' }, 400, cors);

  const tgMsg =
`🌙 Reopen Request
━━━━━━━━━━━━━━━━━━
🔐 Code: ${code}
👤 For: ${name}
🕒 Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
━━━━━━━━━━━━━━━━━━
They're asking to reopen their memory once.

Reply: REOPEN:${code}
Deny:  LOCK:${code}`;

  await sendTelegram(env, tgMsg);
  await updateLetterState(code, 'reopen_requested', env);

  return json({ ok: true }, 200, cors);
}


/* ══════════════════════════════
   STATUS HANDLER
══════════════════════════════ */

async function handleStatus(code, env, cors) {
  const letters = await fetchLettersJSON(env);
  const letter  = letters?.[code];
  if (!letter) return json({ error: 'not found' }, 404, cors);
  return json({ code, state: letter.state || 'active', name: letter.name }, 200, cors);
}


/* ══════════════════════════════
   ADMIN HANDLERS
══════════════════════════════ */

async function handleAdminList(env, cors) {
  const letters = await fetchLettersJSON(env);
  if (!letters) return json({ error: 'failed to fetch' }, 500, cors);

  const list = Object.entries(letters).map(([code, data]) => ({
    code,
    name: data.name,
    state: data.state || 'active',
    reopen_count: data.reopen_count || 0,
    theme: data.theme || 'default'
  }));

  return json({ letters: list }, 200, cors);
}

async function handleAdminUpdate(request, env, cors) {
  const { code, action } = await request.json();

  if (!code || !action) return json({ error: 'missing fields' }, 400, cors);

  const stateMap = {
    reopen: 'reopened_once',
    lock:   'expired',
    reset:  'active',
    fade:   'faded'
  };

  const newState = stateMap[action];
  if (!newState) return json({ error: 'unknown action' }, 400, cors);

  const ok = await updateLetterState(code, newState, env);
  return json({ ok, code, newState }, ok ? 200 : 500, cors);
}


/* ══════════════════════════════
   GITHUB JSON ENGINE
   Fetch → modify → commit letters.json
══════════════════════════════ */

async function fetchLettersJSON(env) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${env.GITHUB_FILE_PATH}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `token ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'LetterPortal-Worker'
      }
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data = await res.json();
    const content = atob(data.content.replace(/\n/g, ''));
    return JSON.parse(content);
  } catch (e) {
    console.error('fetchLettersJSON error:', e);
    return null;
  }
}

async function fetchLettersSHAAndJSON(env) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${env.GITHUB_FILE_PATH}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `token ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'LetterPortal-Worker'
      }
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data = await res.json();
    const content = atob(data.content.replace(/\n/g, ''));
    return { sha: data.sha, letters: JSON.parse(content) };
  } catch (e) {
    console.error('fetchLettersSHAAndJSON error:', e);
    return null;
  }
}

async function commitLettersJSON(letters, sha, message, env) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${env.GITHUB_FILE_PATH}`;
  const encoded = btoa(
  Array.from(
    new TextEncoder().encode(JSON.stringify(letters, null, 2)),
    byte => String.fromCharCode(byte)
  ).join('')
);

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'LetterPortal-Worker'
      },
      body: JSON.stringify({
        message,
        content: encoded,
        sha
      })
    });
    return res.ok;
  } catch (e) {
    console.error('commitLettersJSON error:', e);
    return false;
  }
}

async function updateLetterState(code, newState, env) {
  const result = await fetchLettersSHAAndJSON(env);
  if (!result) return false;

  const { sha, letters } = result;
  if (!letters[code]) return false;

  letters[code].state = newState;
  if (newState === 'reopened_once') {
    letters[code].reopen_count = (letters[code].reopen_count || 0) + 1;
  }

  return commitLettersJSON(
    letters,
    sha,
    `[bot] ${code}: state → ${newState}`,
    env
  );
}

async function upsertLetter(code, letterData, env) {
  const result = await fetchLettersSHAAndJSON(env);
  if (!result) return false;

  const { sha, letters } = result;
  letters[code] = { ...letterData };

  return commitLettersJSON(
    letters,
    sha,
    `[bot] CREATE ${code}: ${letterData.name}`,
    env
  );
}


/* ══════════════════════════════
   TELEGRAM SENDER
══════════════════════════════ */

async function sendTelegram(env, text) {
  try {
    await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'HTML'
        })
      }
    );
  } catch (e) {
    console.error('sendTelegram error:', e);
  }
}


/* ══════════════════════════════
   ADMIN KEY CHECK
══════════════════════════════ */

function checkAdminKey(request, env) {
  const key = request.headers.get('X-Admin-Key');
  return key === env.ADMIN_KEY;
}


/* ══════════════════════════════
   HELPERS
══════════════════════════════ */

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}
