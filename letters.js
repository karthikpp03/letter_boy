/**
 * LETTER PORTAL — letters.js v3
 *
 * Dynamic letter loading from GitHub raw JSON.
 * Falls back to hardcoded LETTERS if fetch fails.
 *
 * Admin can update letters via Telegram → Cloudflare Worker → GitHub API.
 *
 * LETTER STATES:
 *   active            → fresh, never opened with a comment
 *   opened            → comment submitted, memory fading
 *   faded             → permanently faded (one read used)
 *   reopen_requested  → user requested reopen, pending admin approval
 *   reopened_once     → admin approved one extra read
 *   expired           → reopened, then faded again — permanently locked
 */

// GitHub raw URL for letters.json
// Update this to point to your actual repo raw URL
const GITHUB_RAW_URL =
  'https://raw.githubusercontent.com/karthikpp03/letter_boy/main/letters.json';

// Hardcoded fallback (matches letters.json)
const LETTERS_FALLBACK = {
  "728194": {
    name: "Aishu ✨",
    theme: "moonlight",
    state: "active",
    reopen_count: 0,
    letter: `Sometimes...\n\nyou seriously test my patience 😭\n\nbut somehow...\n\nyou still became one of the\nmost comforting people in my life.\n\nWhich honestly feels illegal.\n\nI know we joke too much\ninstead of saying things properly.\n\nBut genuinely...\n\nthank you for staying.\n\nEven during weird phases.\nEven during silent phases.\n\nAnd yes...\n\nyou are still dramatic.`
  },
  "441827": {
    name: "Moon Person 🌙",
    theme: "default",
    state: "active",
    reopen_count: 0,
    letter: `You know what's funny?\n\nSome people become memories.\n\nBut some people become\nspecific comfort feelings.\n\nYou're unfortunately that category 😭\n\nEven random conversations with you\nsomehow became important to me.\n\nAlso please sleep properly.\n\nThis is a warning.`
  },
  "991563": {
    name: "Chaos Partner 💫",
    theme: "default",
    state: "active",
    reopen_count: 0,
    letter: `This letter was supposed to be mature.\n\nThen I remembered who this is for.\n\nImpossible.\n\nStill...\n\nthank you for every stupid joke,\nlate night talk,\nrandom support,\nand emotional nonsense.\n\nLife would've genuinely felt\nmore boring without you.`
  },
  "620145": {
    name: "Professional Idiot 🌸",
    theme: "default",
    state: "active",
    reopen_count: 0,
    letter: `I still don't understand\nhow someone can be this annoying\nand this lovable together.\n\nHonestly impressive.\n\nBut yeah...\n\ndespite all the chaos,\nI really appreciate you.\n\nEven if I don't always say it properly.`
  },
  "843921": {
    name: "Tiny Disaster 🌙",
    theme: "default",
    state: "active",
    reopen_count: 0,
    letter: `You entered my life\nvery randomly.\n\nAnd somehow stayed important.\n\nThat's still kinda crazy to me.\n\nAnyway...\n\ndrink water.\nsleep properly.\nstop overthinking.\n\nThank you ✨`
  },
  "315780": {
    name: "Favorite Human ⭐",
    theme: "default",
    state: "active",
    reopen_count: 0,
    letter: `If friendship had side effects...\n\nours would definitely be:\nlaughing too much\nand emotional confusion.\n\nBut still...\n\nI wouldn't trade it for anything.\n\nThank you for existing da 😭`
  }
};

/**
 * Fetch letters from GitHub raw JSON.
 * Always resolves — falls back to hardcoded on any error.
 */
async function loadLetters() {
  try {
    const res = await fetch(GITHUB_RAW_URL + '?t=' + Date.now(), {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid format');
    }
    // Merge: remote overrides local fallback
    return { ...LETTERS_FALLBACK, ...data };
  } catch (e) {
    console.warn('[Letter Portal] Remote letters failed, using fallback.', e);
    return LETTERS_FALLBACK;
  }
}
