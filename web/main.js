// Boot: load state, wire the shell (header, notes pane, tally, tabs, mobile segments),
// Explain-back (fully working, zero network), and footer health. Ask/Quiz are placeholders
// until T-13 wires the model — they render the DESIGN "model-off" state, which is honestly
// true right now: no model call exists on this page yet.

import {
  loadState,
  saveState,
  setNotes as applyNotes,
  setModelOff as applyModelOff,
  setReveal as applyReveal,
  setActiveTab as applyActiveTab,
  setTally as applyTally,
  recordSession as applyRecordSession,
} from "./state.js";
import { createNotesPane } from "./ui/notes.js";
import { createTallyStrip } from "./ui/tally.js";
import { createExplainSurface } from "./ui/explain.js";
import { modelOffBannerHTML, stateCardHTML } from "./ui/status.js";

let state = loadState();
function setState(next) {
  state = next;
  saveState(state);
}

const els = {
  modelSwitch: document.getElementById("model-switch"),
  modelSwitchWord: document.getElementById("model-switch-word"),
  modelOffBanner: document.getElementById("model-off-banner"),
  colNotes: document.getElementById("col-notes"),
  notesHeader: document.getElementById("notes-header"),
  notesBody: document.getElementById("notes-body"),
  tally: document.getElementById("tally"),
  tabExplain: document.getElementById("tab-explain"),
  tabAsk: document.getElementById("tab-ask"),
  tabQuiz: document.getElementById("tab-quiz"),
  panelExplain: document.getElementById("panel-explain"),
  panelAsk: document.getElementById("panel-ask"),
  panelQuiz: document.getElementById("panel-quiz"),
  segmented: document.getElementById("segmented-tabs"),
  segNotes: document.getElementById("seg-tab-notes"),
  segExplain: document.getElementById("seg-tab-explain"),
  segAsk: document.getElementById("seg-tab-ask"),
  segQuiz: document.getElementById("seg-tab-quiz"),
  backPill: document.getElementById("back-pill"),
  footerModel: document.getElementById("footer-model"),
  footerTests: document.getElementById("footer-tests"),
  footerLine2: document.getElementById("footer-line2"),
};

/* ---------- model toggle (visual + banner; nothing to gate yet) ---------- */
function renderModelSwitch() {
  els.modelSwitch.setAttribute("aria-checked", state.modelOff ? "false" : "true");
  els.modelSwitchWord.textContent = state.modelOff ? "off" : "on";
  els.modelOffBanner.innerHTML = state.modelOff ? modelOffBannerHTML() : "";
}
els.modelSwitch.addEventListener("click", () => {
  setState(applyModelOff(state, !state.modelOff));
  renderModelSwitch();
});

/* ---------- notes pane ---------- */
const notesPane = createNotesPane({
  headerEl: els.notesHeader,
  bodyEl: els.notesBody,
  getState: () => state,
  setNotes: (notes, source) => setState(applyNotes(state, notes, source)),
  onNotesChanged: () => explainSurface.render(),
});

/* ---------- tally strip + reveal toggle ---------- */
const tallyStrip = createTallyStrip({
  el: els.tally,
  getState: () => state,
  onToggleReveal: (reveal) => {
    setState(applyReveal(state, reveal));
    tallyStrip.render();
    explainSurface.setReveal();
  },
});

/* ---------- Explain-back (fully working, zero network) ---------- */
const explainSurface = createExplainSurface({
  panelEl: els.panelExplain,
  getState: () => state,
  setTally: (tally) => {
    setState(applyTally(state, tally));
    tallyStrip.render();
  },
  recordSession: (session) => setState(applyRecordSession(state, session)),
  notesPane,
  notesDisabledReason: () => notesPane.disabledReason(),
  onSentenceActivated: focusNotesFromSentence,
});

/* ---------- Ask / Quiz placeholders (DESIGN §5.4/§5.5 model-off state; T-13 wires the model) ---------- */
function turnModelOn() {
  setState(applyModelOff(state, false));
  renderModelSwitch();
}

function renderAskPlaceholder() {
  els.panelAsk.innerHTML = `
    <div class="surface">
      <p class="prompt-line">Ask anything about the page. Every sentence in the answer has to cite a line, and code checks it.</p>
      <input type="text" disabled placeholder="Ask a question…" maxlength="500" />
      <div class="surface-actions">
        <button type="button" class="btn btn-primary" disabled>Ask</button>
        <span class="disabled-reason">Model isn't wired up yet — Explain-back works fully now.</span>
      </div>
      <div class="result-region">
        ${stateCardHTML({
          variant: "warn",
          title: "Model off — nothing cached for this question.",
          body: "Turn the model on to ask this, or ask a question you've asked before. Explain-back doesn't need the model.",
          actionHTML: '<button type="button" class="btn" id="ask-turn-on">Turn model on</button>',
        })}
      </div>
    </div>`;
  els.panelAsk.querySelector("#ask-turn-on")?.addEventListener("click", turnModelOn);
}

function renderQuizPlaceholder() {
  els.panelQuiz.innerHTML = `
    <div class="surface">
      <p class="prompt-line">Five questions from the page. Any question your notes can't answer is refused, not shown.</p>
      <div class="surface-actions">
        <button type="button" class="btn btn-primary" disabled>Make quiz</button>
        <span class="disabled-reason">Model isn't wired up yet — Explain-back works fully now.</span>
      </div>
      <div class="result-region">
        ${stateCardHTML({
          variant: "warn",
          title: "Model off — nothing cached for a quiz yet.",
          body: "Turn the model on to make a quiz, or open one you've made before. Explain-back doesn't need the model.",
          actionHTML: '<button type="button" class="btn" id="quiz-turn-on">Turn model on</button>',
        })}
      </div>
    </div>`;
  els.panelQuiz.querySelector("#quiz-turn-on")?.addEventListener("click", turnModelOn);
}

/* ---------- tabs (desktop) + segmented control (mobile, DESIGN §7) ---------- */
const SEGMENT_LABEL = { explain: "Explain", ask: "Ask", quiz: "Quiz" };

function isMobile() {
  return typeof matchMedia === "function" && matchMedia("(max-width: 899.98px)").matches;
}

let currentSegment = notesPane.isEmpty() ? "notes" : state.activeTab ?? "explain";
let backPillReturnTo = null;

function applyVisibility() {
  const mobile = isMobile();
  const tab = state.activeTab ?? "explain";

  if (mobile) {
    els.colNotes.hidden = currentSegment !== "notes";
    els.panelExplain.hidden = currentSegment !== "explain";
    els.panelAsk.hidden = currentSegment !== "ask";
    els.panelQuiz.hidden = currentSegment !== "quiz";
  } else {
    els.colNotes.hidden = false;
    els.panelExplain.hidden = tab !== "explain";
    els.panelAsk.hidden = tab !== "ask";
    els.panelQuiz.hidden = tab !== "quiz";
  }

  els.tabExplain.setAttribute("aria-selected", String(tab === "explain"));
  els.tabAsk.setAttribute("aria-selected", String(tab === "ask"));
  els.tabQuiz.setAttribute("aria-selected", String(tab === "quiz"));

  els.segNotes.setAttribute("aria-selected", String(currentSegment === "notes"));
  els.segExplain.setAttribute("aria-selected", String(currentSegment === "explain"));
  els.segAsk.setAttribute("aria-selected", String(currentSegment === "ask"));
  els.segQuiz.setAttribute("aria-selected", String(currentSegment === "quiz"));
}

function selectTab(tab) {
  setState(applyActiveTab(state, tab));
  if (isMobile()) currentSegment = tab;
  applyVisibility();
}

function selectSegment(target) {
  currentSegment = target;
  if (target !== "notes") {
    setState(applyActiveTab(state, target));
    backPillReturnTo = null;
    els.backPill.classList.remove("is-visible");
  }
  applyVisibility();
}

// Called by a working surface when a sentence row is activated. On mobile the notes
// column is display:none until we switch segments, so a scrollIntoView issued before
// that would be a silent no-op — we switch first, then run the caller's scroll on the
// next frame once the pane actually has layout. Returns true when it handled things
// (mobile), so the caller knows not to also scroll immediately itself.
function focusNotesFromSentence(scrollFn) {
  if (!isMobile()) return false;
  backPillReturnTo = currentSegment;
  currentSegment = "notes";
  applyVisibility();
  els.backPill.textContent = `← back to ${SEGMENT_LABEL[backPillReturnTo] ?? "Explain"}`;
  els.backPill.classList.add("is-visible");
  history.pushState({ marginBackTo: backPillReturnTo }, "");
  // Two frames: the first lets the browser commit the hide/show + sticky-position
  // layout change from applyVisibility() above; only the second is guaranteed to see
  // the settled geometry scrollIntoView needs.
  requestAnimationFrame(() => requestAnimationFrame(() => scrollFn?.()));
  return true;
}

els.backPill.addEventListener("click", (e) => {
  e.preventDefault();
  if (backPillReturnTo) {
    currentSegment = backPillReturnTo;
    backPillReturnTo = null;
    applyVisibility();
  }
  els.backPill.classList.remove("is-visible");
});

window.addEventListener("popstate", (e) => {
  if (e.state?.marginBackTo) {
    currentSegment = "notes";
    backPillReturnTo = e.state.marginBackTo;
    applyVisibility();
    els.backPill.textContent = `← back to ${SEGMENT_LABEL[backPillReturnTo] ?? "Explain"}`;
    els.backPill.classList.add("is-visible");
  } else {
    currentSegment = state.activeTab ?? "explain";
    els.backPill.classList.remove("is-visible");
    applyVisibility();
  }
});

els.tabExplain.addEventListener("click", () => selectTab("explain"));
els.tabAsk.addEventListener("click", () => selectTab("ask"));
els.tabQuiz.addEventListener("click", () => selectTab("quiz"));

els.segNotes.addEventListener("click", () => selectSegment("notes"));
els.segExplain.addEventListener("click", () => selectSegment("explain"));
els.segAsk.addEventListener("click", () => selectSegment("ask"));
els.segQuiz.addEventListener("click", () => selectSegment("quiz"));

window.addEventListener("resize", applyVisibility);

/* ---------- footer (DESIGN §5.7 line 1 + tag legend; calibration omitted — T-11 hasn't landed) ---------- */
const TAG_LEGEND = [
  { cls: "chip-notes", text: "Notes", title: "Your text, exactly as pasted. Never altered." },
  { cls: "chip-sample", text: "Sample", title: "Bundled sample notes. Source and licence in the file." },
  { cls: "chip-rule", text: "Rule &middot; Ledger v1.0", title: "Verdict computed by code from your notes. Identical with the model off." },
  { cls: "chip-gen", text: "Generated &middot; &lt;model&gt;", title: "Text the model wrote. Always checked, never trusted." },
  { cls: "chip-gen", text: "Cached &middot; HH:MM", title: "A generated result stored earlier in this browser." },
  { cls: "chip-fixture", text: "Fixture &middot; localhost", title: "Recorded response replayed by the dev server. Impossible in production." },
];

function renderFooterLegend() {
  els.footerLine2.innerHTML = TAG_LEGEND.map(
    (t) => `<span class="chip chip-tag ${t.cls}" title="${t.title}">${t.text}<span class="vh"> — ${t.title}</span></span>`
  ).join(" ");
}

async function bootFooter() {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    if (!data.keyPresent) {
      els.footerModel.textContent = "Model: no key set";
      els.footerModel.classList.add("warn");
    } else {
      els.footerModel.textContent = `Model ${data.model ?? "unknown"}`;
    }
  } catch {
    els.footerModel.textContent = "Model: health unreachable";
    els.footerModel.classList.add("warn");
  }

  try {
    const res = await fetch("/web/data/test-results.json");
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const date = data.at ? String(data.at).slice(0, 10) : "";
    els.footerTests.textContent = `${data.pass}/${data.total} tests${date ? ` · ${date}` : ""}`;
  } catch {
    els.footerTests.textContent = "tests: unavailable";
  }
}

/* ---------- boot ---------- */
renderModelSwitch();
notesPane.render();
tallyStrip.render();
explainSurface.render();
renderAskPlaceholder();
renderQuizPlaceholder();
renderFooterLegend();
applyVisibility();
bootFooter();
