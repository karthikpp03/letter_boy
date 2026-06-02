# Letter Portal — Setup Guide

## What's in this update

- **letters.json** — dynamic data source (commit to GitHub root)
- **letters.js** — now fetches from GitHub raw URL with fallback
- **script.js** — full state machine, reopen flow, edge-case handling
- **style.css** — reopen screen styles + memory fade animation (appended)
- **worker.js** — complete Cloudflare Worker implementation
- **admin.html** — hidden admin panel at `/admin`
- **_redirects** — Netlify routing for `/letter/:code`
- **wrangler.toml** — Worker deployment config

---

## Step 1: Push files to GitHub

Commit all files to your repo: `karthikpp03/letter_boy`

Make sure `letters.json` is in the **root** of the repo.

---

## Step 2: Set Cloudflare Worker secrets

```bash
cd letterboy  # folder with wrangler.toml + worker.js
npx wrangler secret put TELEGRAM_BOT_TOKEN
# paste: 8807520611:AAHw3Up1WqiCCn94gC473fn03mt6rfCL66Q

npx wrangler secret put TELEGRAM_CHAT_ID
# paste: 5399876396

npx wrangler secret put GITHUB_TOKEN
# paste: your GitHub personal access token (needs repo write)

npx wrangler secret put GITHUB_REPO
# paste: karthikpp03/letter_boy

npx wrangler secret put GITHUB_FILE_PATH
# paste: letters.json

npx wrangler secret put ADMIN_KEY
# paste: whatever password you want for /admin
```

Then deploy:
```bash
npx wrangler deploy worker.js --name letterboy-api
```

---

## Step 3: Set Telegram Webhook

Run this once (replace with your actual Worker URL):

```
https://api.telegram.org/bot8807520611:AAHw3Up1WqiCCn94gC473fn03mt6rfCL66Q/setWebhook?url=https://letterboy-api.zeus-karthik11.workers.dev/webhook
```

Open that URL in your browser. You should see `{"ok":true}`.

---

## Step 4: Deploy to Netlify

Push everything to GitHub. Netlify will auto-deploy.

The `_redirects` file handles:
- `/letter/728194` → `index.html` (JS extracts code from URL)
- `/admin` → `admin.html`

---

## Telegram Admin Commands

Once webhook is set, send messages from your Telegram chat:

### Create a new letter:
```
CREATE LETTER
CODE:123456
NAME:Someone Special 🌙
THEME:moonlight
LETTER:
Your emotional letter content here.

It can be multiline.
Empty lines become breathing space.
```

### Approve reopen:
```
REOPEN:728194
```

### Lock permanently:
```
LOCK:728194
```

### Check status:
```
STATUS:728194
```

---

## Memory State Flow

```
active
  └─► (comment submitted) ─► faded
        └─► (user requests) ─► reopen_requested
              └─► (admin approves) ─► reopened_once
                    └─► (comment submitted again) ─► expired (locked forever)
```

---

## Admin Panel

Visit: `https://letterboy.netlify.app/admin`

Enter your `ADMIN_KEY` to log in.

You can:
- View all letter states
- Approve reopens
- Lock memories
- Reset states

---

## Share a letter directly

```
https://letterboy.netlify.app/letter/728194
```

The code auto-fills and the portal opens automatically.
