// Notes pane (DESIGN §2.1, §5.2): source of truth, tagged Notes. Owns paste/file/sample/clear,
// every honest state, and the highlighted render the signature moment drives.

import { splitSentences } from "../../core/sentences.js";
import { MAX_NOTES_CHARS } from "../../core/constants.js";
import { escapeHTML } from "./sentence.js";

const MIN_SENTENCES = 3;
const MIN_CHARS = 120;

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function headingRegions(text) {
  const regions = [];
  let offset = 0;
  for (const line of text.split("\n")) {
    const m = /^\s*#{1,6}\s+/.exec(line);
    if (m) {
      // markLen hides the "#"/"##" prefix visually (vh) without removing it from the
      // DOM — the string itself is untouched, only presentation skips the marker.
      regions.push({ start: offset, end: offset + line.length, kind: "heading", markLen: m[0].length });
    }
    offset += line.length + 1;
  }
  return regions;
}

// Builds the notes article HTML in one pass: headings bolded, GROUNDED spans marked,
// struck student sentences' closest lines dashed-underlined. Text itself is never altered.
// Every note sentence (marked or not) gets a data-line-start wrapper so "what you missed"
// items and future surfaces (T-13) can scroll to any line, not just a cited one.
function intersects(a, b) {
  return a.start < b.end && b.start < a.end;
}

function buildNotesHTML(rawText, verdicts, isStudent) {
  // core/ledger.js derives span from the normalised-text offset map, so it can land a
  // character or two short of the note sentence's own boundary (trailing punctuation is
  // stripped by normalize()). Match by overlap, same as core/missed.js, not by equality.
  const markVerdicts = (verdicts ?? []).filter(
    (v) => v.span && (v.verdict === "GROUNDED" || (v.verdict === "INVENTED" && isStudent))
  );

  const regions = [...headingRegions(rawText)];
  for (const s of splitSentences(rawText)) {
    const v = markVerdicts.find((v) => intersects(v.span, s));
    const mark = !v
      ? null
      : v.verdict === "GROUNDED"
        ? { kind: "mark", sentenceIndex: v.i, label: `cited by sentence ${v.i + 1}` }
        : { kind: "closest", sentenceIndex: v.i, label: "closest line" };
    regions.push({
      start: s.start,
      end: s.end,
      kind: "line",
      mark,
    });
  }
  regions.sort((a, b) => a.start - b.start || b.end - a.end);

  let html = "";
  let cursor = 0;
  for (const r of regions) {
    if (r.start < cursor) continue; // overlap guard: first region wins
    html += escapeHTML(rawText.slice(cursor, r.start));
    if (r.kind === "heading") {
      const markHTML = escapeHTML(rawText.slice(r.start, r.start + r.markLen));
      const textHTML = escapeHTML(rawText.slice(r.start + r.markLen, r.end));
      html += `<strong class="notes-heading"><span class="vh">${markHTML}</span>${textHTML}</strong>`;
      cursor = r.end;
      continue;
    }
    const inner = escapeHTML(rawText.slice(r.start, r.end));
    if (r.kind === "line") {
      if (r.mark?.kind === "mark") {
        html += `<span class="mark-wrap" data-line-start="${r.start}"><span class="gutter-label">${r.mark.label}</span><mark class="span pending" data-sentence="${r.mark.sentenceIndex}">${inner}</mark></span>`;
      } else if (r.mark?.kind === "closest") {
        html += `<span class="mark-wrap" data-line-start="${r.start}"><span class="gutter-label">${r.mark.label}</span><span class="closest" data-sentence="${r.mark.sentenceIndex}">${inner}</span></span>`;
      } else {
        html += `<span class="note-line" data-line-start="${r.start}">${inner}</span>`;
      }
    }
    cursor = r.end;
  }
  html += escapeHTML(rawText.slice(cursor));
  return html;
}

export function createNotesPane({ headerEl, bodyEl, getState, setNotes, onNotesChanged, fetchImpl }) {
  let editing = false;
  let sampleDismissed = false;
  let confirmingClear = false;
  let absenceText = null;
  const fetcher = fetchImpl ?? (typeof fetch === "function" ? fetch.bind(globalThis) : null);

  function notesInfo() {
    const notes = getState().notes ?? "";
    const sentences = splitSentences(notes);
    return {
      notes,
      len: notes.length,
      sentenceCount: sentences.length,
      tooShort: notes.length > 0 && (sentences.length < MIN_SENTENCES || notes.length < MIN_CHARS),
      overLimit: notes.length > MAX_NOTES_CHARS,
      empty: notes.length === 0,
    };
  }

  function renderHeader() {
    const { notes, len, overLimit, empty } = notesInfo();
    const source = getState().notesSource;
    const isSample = source === "sample" && !empty;

    const chips = [
      !empty ? `<span class="chip chip-tag chip-notes" title="Your text, exactly as pasted. Never altered.">Notes</span>` : "",
      isSample
        ? `<span class="chip chip-tag chip-sample" title="Bundled sample notes. Source and licence in the file.">Sample</span>`
        : "",
    ].join(" ");

    const counterClass = overLimit ? "counter over" : "counter";
    const counterText = `${len.toLocaleString()} / ${MAX_NOTES_CHARS.toLocaleString()} chars`;

    const actionsRow = confirmingClear
      ? `
        <div class="notes-actions" id="notes-clear-confirm">
          <span>Clear notes?</span>
          <button type="button" class="btn" id="notes-clear-yes">Clear</button>
          <button type="button" class="btn" id="notes-clear-keep">Keep</button>
        </div>`
      : `
        <div class="notes-actions">
          <button type="button" class="btn" id="notes-paste-btn">Paste</button>
          <label class="btn" for="notes-file-input" id="notes-file-label">.txt/.md</label>
          <input type="file" accept=".txt,.md" id="notes-file-input" class="vh" />
          <button type="button" class="btn" id="notes-load-sample">Load sample</button>
          <button type="button" class="btn" id="notes-clear-btn"${empty ? " disabled" : ""}>Clear</button>
        </div>`;

    headerEl.innerHTML = `
      <div class="notes-header-row">
        <strong>Notes</strong>
        ${chips}
      </div>
      ${actionsRow}
      <div class="notes-meta">
        <span class="${counterClass}">${counterText}</span> &middot; Paste &middot; .txt/.md &middot; Load sample &middot; Clear
      </div>
    `;

    if (overLimit) {
      const over = len - MAX_NOTES_CHARS;
      headerEl.insertAdjacentHTML(
        "beforeend",
        `<div class="strip strip-warn">Too long by ${over.toLocaleString()} characters. The Ledger reads at most ${MAX_NOTES_CHARS.toLocaleString()}.
          <button type="button" class="btn-link" id="notes-trim-btn">Trim to ${MAX_NOTES_CHARS.toLocaleString()}</button>
        </div>`
      );
    } else if (isSample && !sampleDismissed) {
      headerEl.insertAdjacentHTML(
        "beforeend",
        `<div class="strip strip-sample">
          <span>Sample notes: Mitochondria and cellular respiration &middot; source and licence in the file. Paste your own to replace.</span>
          <button type="button" class="btn-link" id="notes-sample-dismiss">Dismiss</button>
        </div>`
      );
    }

    const shortInfo = notesInfo();
    if (shortInfo.tooShort) {
      headerEl.insertAdjacentHTML(
        "beforeend",
        `<div class="strip strip-warn">Notes too short to check — the Ledger needs at least 3 sentences (you have ${shortInfo.sentenceCount}).</div>`
      );
    }

    if (absenceText) {
      headerEl.insertAdjacentHTML("beforeend", `<div class="absence-strip">${escapeHTML(absenceText)}</div>`);
    }

    wireHeaderEvents();
  }

  function renderBody(verdicts, isStudent) {
    const { notes, empty } = notesInfo();
    if (editing) {
      bodyEl.innerHTML = `
        <textarea class="notes-editor" id="notes-editor" rows="14" placeholder="Paste your notes here…">${escapeHTML(
          getState().notes ?? ""
        )}</textarea>
        <div class="editor-actions"><button type="button" class="btn btn-primary" id="notes-editor-done">Done</button></div>
      `;
      wireEditorEvents();
      return;
    }
    if (empty) {
      bodyEl.innerHTML = `
        <div class="drop-zone" id="notes-drop-zone">
          <p>Paste your notes here, drop a .txt or .md, or</p>
          <button type="button" class="btn btn-primary" id="notes-empty-load-sample">Load sample</button>
        </div>
      `;
      wireDropZone();
      return;
    }
    bodyEl.innerHTML = `<article class="notes" aria-label="Your notes">${buildNotesHTML(notes, verdicts, isStudent)}</article>`;
  }

  function wireHeaderEvents() {
    headerEl.querySelector("#notes-paste-btn")?.addEventListener("click", () => {
      editing = true;
      renderBody(null, false);
    });
    headerEl.querySelector("#notes-file-input")?.addEventListener("change", onFileChosen);
    headerEl.querySelector("#notes-load-sample")?.addEventListener("click", loadSample);
    headerEl.querySelector("#notes-clear-btn")?.addEventListener("click", () => {
      confirmingClear = true;
      renderHeader();
    });
    headerEl.querySelector("#notes-clear-yes")?.addEventListener("click", () => {
      confirmingClear = false;
      commitNotes("", "");
    });
    headerEl.querySelector("#notes-clear-keep")?.addEventListener("click", () => {
      confirmingClear = false;
      renderHeader();
    });
    headerEl.querySelector("#notes-trim-btn")?.addEventListener("click", () => {
      const notes = getState().notes ?? "";
      const sentences = splitSentences(notes.slice(0, MAX_NOTES_CHARS));
      const cut = sentences.length ? sentences[sentences.length - 1].end : MAX_NOTES_CHARS;
      commitNotes(notes.slice(0, cut), getState().notesSource);
    });
    headerEl.querySelector("#notes-sample-dismiss")?.addEventListener("click", () => {
      sampleDismissed = true;
      renderHeader();
    });
  }

  function wireEditorEvents() {
    bodyEl.querySelector("#notes-editor-done")?.addEventListener("click", () => {
      const text = bodyEl.querySelector("#notes-editor").value;
      editing = false;
      commitNotes(text, "pasted");
    });
  }

  function wireDropZone() {
    bodyEl.querySelector("#notes-empty-load-sample")?.addEventListener("click", loadSample);
    const zone = bodyEl.querySelector("#notes-drop-zone");
    if (!zone) return;
    zone.addEventListener("dragover", (e) => e.preventDefault());
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) readFile(file);
    });
  }

  function onFileChosen(e) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
    e.target.value = "";
  }

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = () => commitNotes(String(reader.result ?? ""), "file");
    reader.readAsText(file);
  }

  async function loadSample() {
    if (!fetcher) return;
    try {
      const res = await fetcher("/fixtures/sample-notes.md");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const raw = await res.text();
      // The fixture's leading HTML comment is source/licence attribution for the repo,
      // not student-facing content — strip it before it becomes "the notes" (the char
      // count, the Ledger, and the pane all read state.notes verbatim from here on).
      const text = raw.replace(/^\s*<!--[\s\S]*?-->\s*/, "");
      sampleDismissed = false;
      commitNotes(text, "sample");
    } catch {
      absenceText = "Couldn't load the sample notes — check your connection and try again.";
      renderHeader();
    }
  }

  function commitNotes(text, source) {
    setNotes(text, source);
    render(null, false);
    onNotesChanged?.();
  }

  function render(verdicts = null, isStudent = false) {
    renderHeader();
    renderBody(verdicts, isStudent);
  }

  // Applies a fresh verdict set: re-renders the pane once with marks, fades them in,
  // and scrolls to the first struck sentence's closest line (else first grounded span).
  function applyVerdicts(verdicts, { isStudent }) {
    editing = false;
    render(verdicts, isStudent);
    const container = bodyEl.querySelector(".notes");
    if (!container) return;
    requestAnimationFrame(() => {
      container.querySelectorAll("mark.span.pending").forEach((m) => m.classList.remove("pending"));
    });
    const firstStruckIdx = verdicts.find((v) => v.verdict === "INVENTED" && isStudent && v.span);
    const target = firstStruckIdx
      ? container.querySelector(`.closest[data-sentence="${firstStruckIdx.i}"]`)
      : container.querySelector("mark.span");
    if (target) {
      target.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  }

  function setActiveSentence(i) {
    bodyEl.querySelectorAll(".active").forEach((el) => el.classList.remove("active"));
    if (i == null) return;
    bodyEl.querySelectorAll(`[data-sentence="${i}"]`).forEach((el) => el.classList.add("active"));
  }

  // For a struck Ask/Quiz (model) sentence whose citation WAS found in the notes (span
  // present) but failed on number/overlap: DESIGN §3 "absence made visible" wants that cited
  // line to get the same dashed emphasis a student's closest line gets, but only while the
  // sentence is hovered/focused — it was never pre-rendered as a mark because the model isn't
  // the student. `.note-line` is the plain per-sentence wrapper every note line already has
  // (built for "what you missed" scrolling); reuse it here as the hover target.
  function setActiveByLineStart(start) {
    bodyEl.querySelectorAll(".line-cited").forEach((el) => el.classList.remove("line-cited"));
    if (start == null) return;
    bodyEl.querySelector(`.note-line[data-line-start="${start}"]`)?.classList.add("line-cited");
  }

  function setAbsence(text) {
    absenceText = text;
    renderHeader();
  }

  function scrollToOffset(start) {
    const target = bodyEl.querySelector(`[data-line-start="${start}"]`);
    if (target) {
      target.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  }

  function clearAbsence() {
    if (!absenceText) return;
    absenceText = null;
    renderHeader();
  }

  render();

  return {
    render,
    applyVerdicts,
    setActiveSentence,
    setActiveByLineStart,
    setAbsence,
    scrollToOffset,
    clearAbsence,
    notesInfo,
    isEmpty: () => notesInfo().empty,
    isUsable: () => {
      const i = notesInfo();
      return !i.empty && !i.tooShort && !i.overLimit;
    },
    disabledReason: () => {
      const i = notesInfo();
      if (i.empty) return "Add notes first.";
      if (i.tooShort) return "Notes too short.";
      if (i.overLimit) return "Notes over the limit.";
      return null;
    },
  };
}
