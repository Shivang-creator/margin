import { normalize } from "./normalize.js";
import { tokenize, contentTokens } from "./tokens.js";

// Markdown leading markers: headings (#..######), bullets (- or *), numbered lists (1.).
const MD_PREFIX_RE = /^\s*(#{1,6}\s+|[-*]\s+|\d+\.\s+)/;
const ABBREVIATIONS = new Set(["e.g", "i.e", "dr", "vs"]);

function stripMarkdownPrefixLength(line) {
  const m = MD_PREFIX_RE.exec(line);
  return m ? m[0].length : 0;
}

// Finds [start, end) spans, relative to `text`, of sentence-like fragments
// split on . ! ? followed by whitespace or end-of-text, skipping known
// abbreviations and single-capital-letter initials.
function sentenceSpansInText(text) {
  const spans = [];
  let segStart = 0;
  const re = /[.!?](?=\s|$)/g;
  let m;
  while ((m = re.exec(text))) {
    const idx = m.index;
    const punct = text[idx];
    if (punct === ".") {
      let ts = idx;
      while (ts > 0 && !/\s/.test(text[ts - 1])) ts--;
      const token = text.slice(ts, idx);
      if (ABBREVIATIONS.has(token.toLowerCase()) || /^[A-Z]$/.test(token)) {
        continue;
      }
    }
    const end = idx + 1;
    spans.push([segStart, end]);
    let ns = end;
    while (ns < text.length && /\s/.test(text[ns])) ns++;
    segStart = ns;
  }
  if (segStart < text.length) spans.push([segStart, text.length]);
  return spans;
}

export function splitSentences(original) {
  const results = [];
  let lineOffset = 0;
  const lines = original.split("\n");
  for (const line of lines) {
    const prefixLen = stripMarkdownPrefixLength(line);
    const effective = line.slice(prefixLen);
    const effectiveOffset = lineOffset + prefixLen;

    for (const [s, e] of sentenceSpansInText(effective)) {
      let ts = s;
      let te = e;
      while (ts < te && /\s/.test(effective[ts])) ts++;
      while (te > ts && /\s/.test(effective[te - 1])) te--;
      if (ts >= te) continue;

      const text = effective.slice(ts, te);
      const norm = normalize(text).norm;
      if (contentTokens(tokenize(norm)).length === 0) continue;

      results.push({
        text,
        start: effectiveOffset + ts,
        end: effectiveOffset + te,
      });
    }

    lineOffset += line.length + 1; // +1 for the newline consumed by split("\n")
  }
  return results;
}
