/**
 * LETTER PORTAL — letters.js
 *
 * HOW TO UPDATE LETTERS FROM TELEGRAM:
 * ─────────────────────────────────────
 * Option 1 (easiest): Edit this file directly.
 *   Add/edit entries in the LETTERS object below.
 *
 * Option 2 (remote JSON):
 *   Host a raw JSON file on GitHub Gist or any URL,
 *   then set REMOTE_LETTERS_URL below.
 *   Format of the JSON must match the LETTERS object.
 *
 * Option 3 (Telegram-driven):
 *   Use a Telegram Bot webhook + a small Cloudflare Worker
 *   to write JSON to a Gist, then set the URL below.
 *
 * LETTER STRUCTURE:
 *   "CODE": {
 *     name: "Display Name 🌙",
 *     letter: `Multi-line text here...`
 *   }
 */

// Optional: set a URL to a remote JSON file to load letters from.
// Leave as null to use only the LETTERS object below.
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
 * Loads letters — from remote URL if set, otherwise uses LETTERS above.
 * Always resolves with a letters object.
 */
async function loadLetters() {
  if (!REMOTE_LETTERS_URL) return LETTERS;
  try {
    const res = await fetch(REMOTE_LETTERS_URL);
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    return data;
  } catch (e) {
    console.warn("Remote letters failed, using local.", e);
    return LETTERS;
  }
}