/**
 * LETTER PORTAL — letters.js v2
 *
 * HOW TO UPDATE LETTERS:
 * ─────────────────────────────────────
 * Option 1 (easiest): Edit the LETTERS object below directly.
 *
 * Option 2 (dynamic / remote):
 *   Host a raw JSON file on GitHub Gist (or any CORS-enabled URL),
 *   then set REMOTE_LETTERS_URL below.
 *
 *   Example GitHub Gist workflow:
 *   1. Go to gist.github.com → New gist
 *   2. Paste your JSON (matching the LETTERS structure)
 *   3. Click "Create public gist"
 *   4. Click "Raw" → copy that URL
 *   5. Paste it as REMOTE_LETTERS_URL below
 *
 * Option 3 (Telegram-driven):
 *   Use a Telegram Bot + Cloudflare Worker to auto-update a Gist,
 *   then set the Gist raw URL below.
 *
 * LETTER FORMAT:
 *   "CODE": {
 *     name: "Display Name 🌙",
 *     letter: `Multi-line emotional message here.
 *
 * Blank lines become spacer lines in the letter.
 * Each line is revealed with a cinematic animation.`
 *   }
 *
 * TIPS:
 *   - Empty lines create breathing space (dramatic pauses).
 *   - Keep lines short for emotional rhythm.
 *   - No hard limit on letter length — the paper scales gracefully.
 */

// Set a GitHub Gist raw URL here to enable remote dynamic letters.
// Leave as null to use only the hardcoded LETTERS object below.
const REMOTE_LETTERS_URL = null;

const LETTERS = {

  "728194": {
    name: "Aishu ✨",
    letter: `Sometimes...

you seriously test my patience 😭

but somehow...

you still became one of the
most comforting people in my life.

Which honestly feels illegal.

I know we joke too much
instead of saying things properly.

But genuinely...

thank you for staying.

Even during weird phases.
Even during silent phases.

And yes...

you are still dramatic.`
  },

  "441827": {
    name: "Moon Person 🌙",
    letter: `You know what's funny?

Some people become memories.

But some people become
specific comfort feelings.

You're unfortunately that category 😭

Even random conversations with you
somehow became important to me.

Also please sleep properly.

This is a warning.`
  },

  "991563": {
    name: "Chaos Partner 💫",
    letter: `This letter was supposed to be mature.

Then I remembered who this is for.

Impossible.

Still...

thank you for every stupid joke,
late night talk,
random support,
and emotional nonsense.

Life would've genuinely felt
more boring without you.`
  },

  "620145": {
    name: "Professional Idiot 🌸",
    letter: `I still don't understand
how someone can be this annoying
and this lovable together.

Honestly impressive.

But yeah...

despite all the chaos,
I really appreciate you.

Even if I don't always say it properly.`
  },

  "843921": {
    name: "Tiny Disaster 🌙",
    letter: `You entered my life
very randomly.

And somehow stayed important.

That's still kinda crazy to me.

Anyway...

drink water.
sleep properly.
stop overthinking.

Thank you ✨`
  },

  "315780": {
    name: "Favorite Human ⭐",
    letter: `If friendship had side effects...

ours would definitely be:
laughing too much
and emotional confusion.

But still...

I wouldn't trade it for anything.

Thank you for existing da 😭`
  }

};

/**
 * Loads letters — from remote URL if configured, otherwise uses local LETTERS.
 * Always resolves with a valid letters object.
 * Supports long multiline letters with graceful fallback.
 */
async function loadLetters() {
  if (!REMOTE_LETTERS_URL) return LETTERS;

  try {
    const res = await fetch(REMOTE_LETTERS_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Validate basic structure
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid format');
    }

    // Merge with local as fallback (remote overrides local)
    return { ...LETTERS, ...data };

  } catch (e) {
    console.warn('[Letter Portal] Remote letters failed, using local.', e);
    return LETTERS;
  }
}