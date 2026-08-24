// Shared sentence row renderer (DESIGN §2.3, §3). Used by Explain-back now; Ask/Quiz (T-13)
// reuse it so the signature moment is byte-identical wherever a verdict is shown.

import { reasonFor } from "../../core/reasons.js";

export function escapeHTML(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(text, max) {
  const t = String(text ?? "");
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

// Which 1-based note-sentence line a verdict's span falls in, or null (no span / no match).
export function noteLineNumber(noteSentences, span) {
  if (!span || !noteSentences) return null;
  for (let i = 0; i < noteSentences.length; i++) {
    const n = noteSentences[i];
    if (span.start < n.end && n.start < span.end) return i + 1;
  }
  return null;
}

function reasonShort(v, isStudent) {
  if (isStudent && v.reason === "LOW_OVERLAP") return "says more than the closest line";
  return reasonFor(v.reason).short;
}

// sentenceRowHTML(v, { index, isStudent, noteSentences }) -> HTML string for one <li>.
// `index` sets the CSS stagger variable --i so strikes draw left-to-right in list order.
export function sentenceRowHTML(v, { index = 0, isStudent = false, noteSentences = null } = {}) {
  const grounded = v.verdict === "GROUNDED";
  const cls = grounded ? "verdict-grounded" : "verdict-invented";
  const lineNo = grounded ? noteLineNumber(noteSentences, v.span) : null;
  const textHTML = escapeHTML(v.text);
  const bodyHTML = grounded ? textHTML : `<s>${textHTML}</s>`;
  const vhPrefix = grounded ? "Grounded: " : "Struck: ";

  const chip = grounded
    ? `<span class="chip chip-verdict chip-grounded">GROUNDED${lineNo ? ` &middot; line ${lineNo}` : ""}</span>`
    : `<span class="chip chip-verdict chip-struck">NOT IN YOUR NOTES</span>`;

  const reasonLine = grounded
    ? ""
    : `<div class="reason">${escapeHTML(reasonShort(v, isStudent))}</div>`;

  const closestLine =
    !grounded && isStudent && v.quote
      ? `<div class="closest-line">closest line: &ldquo;${escapeHTML(truncate(v.quote, 60))}&rdquo;</div>`
      : "";

  return `
    <li class="sentence ${cls}" data-i="${v.i}" style="--i:${index}">
      <span class="mark-square" aria-hidden="true"></span>
      <div class="sentence-main">
        <div class="sentence-row-top">
          <button type="button" class="sentence-text" data-sentence="${v.i}" data-span-start="${v.span ? v.span.start : ""}">
            <span class="vh">${vhPrefix}</span>${bodyHTML}
          </button>
          ${chip}
        </div>
        ${reasonLine}
        ${closestLine}
      </div>
    </li>`;
}

export function sentenceListHTML(verdicts, { isStudent = false, noteSentences = null } = {}) {
  return verdicts
    .map((v, i) => sentenceRowHTML(v, { index: i, isStudent, noteSentences }))
    .join("");
}

// Runs after the fragment is in the DOM: adds .mounted on the next frame so the
// line-through resting state takes over from the ::after draw animation (DESIGN §3.5).
export function mountStrikes(container) {
  if (!container) return;
  requestAnimationFrame(() => container.classList.add("mounted"));
}

export function runLineHTML({ written, grounded, struck }, extraHTML = "") {
  return `<span class="counts">${written} sentence${written === 1 ? "" : "s"} &middot; <b>${grounded}</b> grounded &middot; <b>${struck}</b> struck</span>${extraHTML}`;
}
