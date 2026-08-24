// Explain-back surface (DESIGN §5.3). Zero network: student text -> splitSentences ->
// bestSpan (align) -> ledger -> missed -> reduceTally, all in core/. This is the cold-open
// signature moment and it must work with the network off.

import { splitSentences } from "../../core/sentences.js";
import { runExplainBack } from "../pipeline.js";
import { sentenceListHTML, runLineHTML, mountStrikes } from "./sentence.js";

const PROMPT = "Close your notes. Type what you remember — every sentence gets checked against the page.";

export function createExplainSurface({
  panelEl,
  getState,
  setTally,
  recordSession,
  notesPane,
  notesDisabledReason,
  onSentenceActivated,
}) {
  let lastResult = null; // { verdicts, counts, missedLines, notesAtRun }

  function render() {
    const disabledReason = notesDisabledReason();
    const text = panelEl.querySelector("#explain-textarea")?.value ?? "";
    const hasText = text.trim().length > 0;
    const btnDisabled = Boolean(disabledReason) || !hasText;
    const reason = disabledReason ?? (!hasText ? "Write at least one sentence." : "");

    panelEl.innerHTML = `
      <div class="surface" id="explain-surface">
        <p class="prompt-line">${PROMPT}</p>
        <textarea id="explain-textarea" rows="6" placeholder="Two or three sentences from memory…" ${
          disabledReason ? "disabled" : ""
        }>${escapeAttr(text)}</textarea>
        <p class="surface-hint">&#8984;/Ctrl+Enter to check</p>
        <div class="surface-actions">
          <button type="button" class="btn btn-primary" id="explain-check-btn" ${btnDisabled ? "disabled" : ""}>Check my explanation</button>
          ${reason ? `<span class="disabled-reason">${reason}</span>` : ""}
        </div>
        <div class="result-region" id="explain-result" aria-live="polite">
          ${lastResult ? "" : '<p class="empty-note">Nothing checked yet. This never uses the model — it\'s code against your notes, and works offline.</p>'}
        </div>
      </div>
    `;

    const textarea = panelEl.querySelector("#explain-textarea");
    textarea.addEventListener("input", () => {
      const btn = panelEl.querySelector("#explain-check-btn");
      const reasonEl = panelEl.querySelector(".disabled-reason");
      const has = textarea.value.trim().length > 0;
      const dReason = notesDisabledReason();
      btn.disabled = Boolean(dReason) || !has;
      const text2 = dReason ?? (!has ? "Write at least one sentence." : "");
      if (reasonEl) reasonEl.textContent = text2;
    });
    textarea.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        runCheck();
      }
    });
    panelEl.querySelector("#explain-check-btn").addEventListener("click", runCheck);

    if (lastResult) renderResult();
  }

  function runCheck() {
    const textarea = panelEl.querySelector("#explain-textarea");
    const studentText = textarea.value;
    if (!studentText.trim() || notesDisabledReason()) return;

    const { notes } = getState();
    const result = runExplainBack({ notes, studentText, tally: getState().tally });
    setTally(result.tally);
    recordSession({ surface: "explain-back", counts: result.counts, at: new Date().toISOString() });

    lastResult = { verdicts: result.verdicts, counts: result.counts, missedLines: result.missedLines, notesAtRun: notes };
    renderResult();
    notesPane.applyVerdicts(result.verdicts, { isStudent: true });
  }

  function renderResult() {
    const region = panelEl.querySelector("#explain-result");
    if (!region || !lastResult) return;
    const { verdicts, counts, missedLines, notesAtRun } = lastResult;
    const stale = notesAtRun !== getState().notes;

    const noteSentences = splitSentences(getState().notes ?? "");
    const missedHTML =
      missedLines.length === 0
        ? '<p class="missed-covered">You covered every line.</p>'
        : `<ul>${missedLines
            .map((m) => `<li><button type="button" data-missed-start="${m.start}">${escapeHTML(m.text)}</button></li>`)
            .join("")}</ul>`;

    region.className = `result-region${stale ? " stale" : ""}`;
    region.innerHTML = `
      ${stale ? '<p class="result-stale-label">Notes changed since this check &middot;</p>' : ""}
      <div class="run-line">
        ${runLineHTML(counts)}
        <span class="chip chip-tag chip-rule" title="Verdict computed by code from your notes. Identical with the model off.">Rule &middot; Ledger v1.0</span>
      </div>
      <ul class="sentence-list ${getState().reveal ? "reveal" : ""}" id="explain-sentence-list">
        ${sentenceListHTML(verdicts, { isStudent: true, noteSentences })}
      </ul>
      <div class="missed">
        <h3>What you missed (${missedLines.length} line${missedLines.length === 1 ? "" : "s"} never mentioned)</h3>
        ${missedHTML}
      </div>
    `;

    mountStrikes(region.querySelector("#explain-sentence-list"));

    region.querySelectorAll("[data-missed-start]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const start = Number(btn.dataset.missedStart);
        // Route through onSentenceActivated too: on mobile it must switch to the Notes
        // segment (making the pane visible) *before* we scroll, else scrollIntoView on a
        // display:none element is a silent no-op.
        onSentenceActivated?.(() => notesPane.scrollToOffset(start)) ?? notesPane.scrollToOffset(start);
      });
    });
    region.querySelectorAll(".sentence-text").forEach((btn) => {
      btn.addEventListener("mouseenter", () => notesPane.setActiveSentence(btn.dataset.sentence));
      btn.addEventListener("mouseleave", () => notesPane.setActiveSentence(null));
      btn.addEventListener("focus", () => notesPane.setActiveSentence(btn.dataset.sentence));
      btn.addEventListener("blur", () => notesPane.setActiveSentence(null));
      btn.addEventListener("click", () => {
        notesPane.setActiveSentence(btn.dataset.sentence);
        const doScroll = () => {
          if (btn.dataset.spanStart !== "") notesPane.scrollToOffset(Number(btn.dataset.spanStart));
        };
        const handled = onSentenceActivated?.(doScroll);
        if (!handled) doScroll();
      });
    });
  }

  function setReveal() {
    const list = panelEl.querySelector("#explain-sentence-list");
    if (list) list.classList.toggle("reveal", Boolean(getState().reveal));
  }

  function escapeHTML(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function escapeAttr(text) {
    return escapeHTML(text);
  }

  render();
  return { render, setReveal };
}
