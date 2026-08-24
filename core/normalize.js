// Explicit, tested normalisation with an offset map back to the original string.
// normalize(text) -> { norm, map[] } where map[i] is the original index of norm[i].

const QUOTE_SINGLE = new Set(["’", "‘", "‛"]); // ' ' ‛
const QUOTE_DOUBLE = new Set(["“", "”", "„"]); // " " „
const DASHES = new Set(["–", "—", "‒"]); // – — ‒
const SPACE_LIKE = new Set([" ", "\t", "\n", "\r"]); // NBSP, tab, newline, CR

function isLetter(c) {
  return /\p{L}/u.test(c);
}

function isDigit(c) {
  return /[0-9]/.test(c);
}

export function normalize(text) {
  const len = text.length;

  // Step 1: character substitutions (1:1, no length change).
  // Step 2: per-char lowercase, keeping the original char if lowercasing would
  //         change its length (named case: İ does not shift offsets).
  const step = new Array(len);
  for (let i = 0; i < len; i++) {
    let c = text[i];
    if (QUOTE_SINGLE.has(c)) c = "'";
    else if (QUOTE_DOUBLE.has(c)) c = '"';
    else if (DASHES.has(c)) c = "-";
    else if (SPACE_LIKE.has(c)) c = " ";

    const lowered = c.toLowerCase();
    step[i] = lowered.length === 1 ? lowered : c;
  }

  // Step 3: keep letters, digits, an apostrophe between two letters, and a comma/period
  // between two digits (thousands separator / decimal point — PLAN §4.2's decimal branch
  // was dead code because this step used to space out `,`/`.` before numberTokens ever saw
  // them; R-03). Lookups read a pre-mutation snapshot so deciding char i never depends on
  // whether char i-1 was already turned into a space earlier in this same pass.
  const before3 = step.slice();
  for (let i = 0; i < len; i++) {
    const c = before3[i];
    if (isLetter(c) || isDigit(c)) continue;
    if (
      c === "'" &&
      i > 0 &&
      i < len - 1 &&
      isLetter(before3[i - 1]) &&
      isLetter(before3[i + 1])
    ) {
      continue;
    }
    if (
      (c === "," || c === ".") &&
      i > 0 &&
      i < len - 1 &&
      isDigit(before3[i - 1]) &&
      isDigit(before3[i + 1])
    ) {
      continue;
    }
    step[i] = " ";
  }

  // Step 4: collapse runs of spaces to one, trim ends, tracking original offsets.
  const normChars = [];
  const map = [];
  let lastWasSpace = false;
  for (let i = 0; i < len; i++) {
    const c = step[i];
    if (c === " ") {
      if (!lastWasSpace) {
        normChars.push(" ");
        map.push(i);
        lastWasSpace = true;
      }
    } else {
      normChars.push(c);
      map.push(i);
      lastWasSpace = false;
    }
  }
  while (normChars.length && normChars[0] === " ") {
    normChars.shift();
    map.shift();
  }
  while (normChars.length && normChars[normChars.length - 1] === " ") {
    normChars.pop();
    map.pop();
  }

  return { norm: normChars.join(""), map };
}

// Recovers the original-text span [start, end) for a normalised quote found at
// index `idx` (in norm) of length `quoteNorm.length`.
export function spanFor(map, idx, quoteNormLength) {
  if (quoteNormLength === 0) return null;
  const start = map[idx];
  const end = map[idx + quoteNormLength - 1] + 1;
  return { start, end };
}
