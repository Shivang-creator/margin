// Quiz surface (DESIGN §5.5). notes -> web/model.js -> core/quiz.applyLedgerToQuiz (via
// web/pipeline.applyQuiz) -> kept (GROUNDED) items shown, refused (INVENTED) items collapsed.
// Loading/error states share Ask's shape (§5.4) with "Asking" -> "Writing quiz".

import { applyQuiz } from "../pipeline.js";
import { splitSentences } from "../../core/sentences.js";
import { sentenceRowHTML, mountStrikes, escapeHTML, noteLineNumber } from "./sentence.js";
import { stateCardHTML, countdown, startElapsedTimer } from "./status.js";

const PROMPT = "Five questions from the page. Any question your notes can't answer is refused, not shown.";

function hhmm(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function bypassCacheOnce(realCache) {
  if (!realCache) return realCache;
  return { get: async () => null, set: (...args) => realCache.set(...args) };
}

export function createQuizSurface({
  panelEl,
  getState,
  setTally,
  recordSession,
  notesPane,
  notesDisabledReason,
  getHealthModel,
  getHealthModels,
  fetchImpl,
  cache,
  now,
  onTurnModelOn,
}) {
  let phase = "empty";
  let lastSuccess = null; // { questions, counts, meta, source }
  let answers = {}; // questionIndex -> chosen option index
  let errorInfo = null;
  let stopElapsed = null;
  let stopCountdown = null;
  let elapsedSec = 0;

  function render() {
    const disabledReason = notesDisabledReason();
    const btnDisabled = phase === "loading" || Boolean(disabledReason);

    panelEl.innerHTML = `
      <div class="surface" id="quiz-surface">
        <p class="prompt-line">${PROMPT}</p>
        <div class="surface-actions">
          <button type="button" class="btn btn-primary" id="quiz-btn" ${btnDisabled ? "disabled" : ""}>${
            phase === "loading" ? "Writing quiz…" : "Make quiz"
          }</button>
          ${disabledReason ? `<span class="disabled-reason">${disabledReason}</span>` : ""}
        </div>
        <div class="result-region" id="quiz-result" aria-live="polite"></div>
      </div>
    `;
    panelEl.querySelector("#quiz-btn").addEventListener("click", () => submit());
    renderResultRegion();
  }

  function scoreLine() {
    const kept = (lastSuccess?.questions ?? []).filter((q) => !q.refused);
    const answeredIdx = Object.keys(answers).map(Number);
    if (answeredIdx.length === 0) return "";
    let correct = 0;
    for (const i of answeredIdx) {
      const q = lastSuccess.questions[i];
      if (q && answers[i] === q.answerIndex) correct++;
    }
    return `<p class="tally-sub">${correct} / ${answeredIdx.length} so far</p>`;
  }

  function optionHTML(q, qi, optIndex, optText, noteSentences) {
    const chosen = answers[qi];
    const isChosen = chosen === optIndex;
    const isCorrect = q.answerIndex === optIndex;
    let cls = "option";
    let chip = "";
    if (chosen != null) {
      if (isCorrect) {
        cls += " option-correct";
        const lineNo = noteLineNumber(noteSentences, q.span);
        chip = `<span class="chip chip-verdict chip-grounded">GROUNDED${lineNo ? ` &middot; line ${lineNo}` : ""}</span>`;
      } else if (isChosen) {
        cls += " option-wrong";
        chip = `<span class="chip chip-verdict chip-struck">YOUR ANSWER</span>`;
      }
      if (isChosen) cls += " option-chosen";
    }
    return `<button type="button" class="${cls}" data-qi="${qi}" data-oi="${optIndex}" ${chosen != null ? "disabled" : ""}>
      <span>${escapeHTML(optText)}</span>${chip}
    </button>`;
  }

  function questionHTML(q, qi) {
    if (q.refused) {
      return `
        <details class="refused-item">
          <summary><span class="mark-square" aria-hidden="true"></span>Refused &middot; your notes can't answer this</summary>
          <p class="reason">${escapeHTML(q.question)}</p>
          <ul class="sentence-list">
            ${sentenceRowHTML(
              { i: qi, text: q.statement, verdict: "INVENTED", reason: q.reason, span: q.span, quote: q.quote },
              { index: 0, isStudent: false }
            )}
          </ul>
        </details>`;
    }

    const answered = answers[qi] != null;
    const noteSentences = splitSentences(getState().notes ?? "");
    const statementRow = answered
      ? `<ul class="sentence-list">${sentenceRowHTML(
          { i: qi, text: q.statement, verdict: "GROUNDED", reason: "GROUNDED", span: q.span, quote: q.quote },
          { index: 0, isStudent: false, noteSentences }
        )}</ul>`
      : "";

    return `
      <div class="quiz-item">
        <p class="quiz-question">${escapeHTML(q.question)}</p>
        <div class="quiz-options">
          ${q.options.map((opt, oi) => optionHTML(q, qi, oi, opt, noteSentences)).join("")}
        </div>
        ${statementRow}
      </div>`;
  }

  function successBodyHTML() {
    const { questions, counts, meta, source } = lastSuccess;
    const wrote = counts.written;
    const kept = counts.grounded;
    const refused = counts.struck;
    const isCached = source === "cached";
    const chip = isCached
      ? `<span class="chip chip-tag chip-gen">Cached &middot; <span class="time">${hhmm(meta?.generatedAt)}</span></span>`
      : `<span class="chip chip-tag chip-gen">Generated &middot; ${escapeHTML(meta?.model ?? "model")}</span>`;
    const fixtureChip =
      meta?.provider === "fixture"
        ? `<span class="chip chip-tag chip-fixture">Fixture &middot; localhost</span>`
        : "";
    const askAgain =
      isCached && !getState().modelOff
        ? `<div class="surface-actions"><button type="button" class="btn" id="quiz-again-live">Ask again live</button></div>`
        : "";

    if (kept === 0) {
      return (
        `<div class="run-line"><span>wrote ${wrote} &middot; kept ${kept} &middot; refused ${refused}</span><span>${chip} ${fixtureChip}</span></div>` +
        stateCardHTML({
          variant: "warn",
          title: "Every question was refused.",
          body: "Nothing the model wrote could be traced to a line. Try notes with more concrete statements, or ask again.",
        }) +
        `<div class="quiz-list">${questions.map((q, i) => questionHTML(q, i)).join("")}</div>` +
        askAgain
      );
    }

    return `
      <div class="run-line">
        <span>wrote ${wrote} &middot; kept ${kept} &middot; refused ${refused}</span>
        <span>${chip} ${fixtureChip}</span>
      </div>
      ${scoreLine()}
      <div class="quiz-list" id="quiz-list">${questions.map((q, i) => questionHTML(q, i)).join("")}</div>
      ${askAgain}
    `;
  }

  function previousResultHTML() {
    if (!lastSuccess) return "";
    return `<div class="result-region stale"><p class="result-stale-label">Previous quiz</p>${successBodyHTML()}</div>`;
  }

  function renderResultRegion() {
    const region = panelEl.querySelector("#quiz-result");
    if (!region) return;

    if (phase === "empty") {
      region.className = "result-region";
      region.innerHTML = '<p class="empty-note">No quiz yet.</p>';
      return;
    }
    if (phase === "loading") {
      region.className = "result-region";
      const modelName = getHealthModel() ?? "the model";
      region.innerHTML =
        stateCardHTML({
          variant: "info",
          title: `Writing quiz with ${escapeHTML(modelName)} &middot; <span id="quiz-elapsed">${elapsedSec}</span> s`,
          body: "Answers take 2–10 s. The server gives up at 20 s and says so.",
        }) + previousResultHTML();
      return;
    }
    if (phase === "result") {
      region.className = "result-region";
      region.innerHTML = successBodyHTML();
      wireResultEvents(region);
      return;
    }
    if (phase === "error") {
      region.className = "result-region";
      region.innerHTML = errorCardHTML() + previousResultHTML();
      wireErrorActions(region);
      if (lastSuccess) wireResultEvents(region, true);
    }
  }

  function wireResultEvents(region, isStale) {
    region.querySelectorAll(".sentence-list").forEach((ul) => mountStrikes(ul));
    region.querySelectorAll(".option:not(:disabled)").forEach((btn) => {
      btn.addEventListener("click", () => {
        const qi = Number(btn.dataset.qi);
        const oi = Number(btn.dataset.oi);
        answers[qi] = oi;
        const q = lastSuccess.questions[qi];
        recordSession({ surface: "quiz", counts: { written: 1, grounded: oi === q.answerIndex ? 1 : 0, struck: oi === q.answerIndex ? 0 : 1 }, at: new Date().toISOString() });
        renderResultRegion();
        if (q.span) {
          notesPane.applyVerdicts([{ i: qi, text: q.statement, verdict: "GROUNDED", reason: "GROUNDED", span: q.span, quote: q.quote }], { isStudent: false });
        }
      });
    });
    if (!isStale) region.querySelector("#quiz-again-live")?.addEventListener("click", () => submit({ bypassCache: true }));
  }

  function errorCardHTML() {
    const { code, detail, retryAfterSec } = errorInfo ?? {};
    switch (code) {
      case "model-off":
        return stateCardHTML({
          variant: "warn",
          title: "Model off — nothing cached for a quiz yet.",
          body: "Turn the model on to make a quiz, or open one you've made before. Explain-back doesn't need the model.",
          actionHTML: '<button type="button" class="btn" id="err-turn-on">Turn model on</button>',
        });
      case "offline":
        return stateCardHTML({
          variant: "warn",
          title: "You're offline.",
          body: "Ask and Quiz need the network. Explain-back doesn't — it never leaves this page.",
        });
      case "rate-limit-minute":
        return stateCardHTML({
          variant: "warn",
          title: `<span id="rl-title">Rate limited — try again in ${retryAfterSec ?? 30} s</span>`,
          body: "The free tier allows a few requests a minute. The Ledger has nothing to check until a new answer arrives.",
        });
      case "rate-limit-day":
        return stateCardHTML({
          variant: "error",
          title: "Daily quota exhausted on every model.",
          body: `Tried ${escapeHTML((getHealthModels() ?? []).join(", "))}. Quota resets around 12:30 IST. Cached answers still open; Explain-back still works.`,
        });
      case "bad-model-output":
        return stateCardHTML({
          variant: "error",
          title: "The model's answer didn't follow the contract.",
          body: `It has to return sentences with a quote each. It returned something else, so nothing was checked and nothing is shown. First 200 chars: <code>${escapeHTML(
            detail ?? ""
          )}</code>`,
          actionHTML: '<button type="button" class="btn" id="err-retry">Try once more</button>',
        });
      case "timeout":
        return stateCardHTML({
          variant: "error",
          title: "No answer in 20 s.",
          body: "The server stopped waiting. Nothing was invented to fill the gap.",
          actionHTML: '<button type="button" class="btn" id="err-retry">Try once more</button>',
        });
      case "no-key":
        return stateCardHTML({
          variant: "error",
          title: "The model call failed (<code>no-key</code>).",
          body: "Explain-back keeps working. If you're the developer: <code>no-key</code> means <code>GEMINI_API_KEY</code> isn't set in this environment.",
        });
      default:
        return stateCardHTML({
          variant: "error",
          title: `The model call failed (<code>${escapeHTML(code ?? "upstream")}</code>).`,
          body: "Explain-back keeps working.",
          actionHTML: '<button type="button" class="btn" id="err-retry">Try once more</button>',
        });
    }
  }

  function wireErrorActions(region) {
    region.querySelector("#err-turn-on")?.addEventListener("click", () => {
      onTurnModelOn?.();
      render();
    });
    region.querySelector("#err-retry")?.addEventListener("click", () => submit());
    if (errorInfo?.code === "rate-limit-minute") {
      const titleEl = region.querySelector("#rl-title");
      const btn = panelEl.querySelector("#quiz-btn");
      if (btn) btn.disabled = true;
      stopCountdown?.();
      stopCountdown = countdown(
        errorInfo.retryAfterSec ?? 30,
        (s) => {
          if (titleEl) titleEl.textContent = s > 0 ? `Rate limited — try again in ${s} s` : "You can ask again.";
        },
        () => {
          if (btn) btn.disabled = Boolean(notesDisabledReason());
        }
      );
    }
  }

  async function submit(opts = {}) {
    if (notesDisabledReason()) return;
    stopCountdown?.();
    stopCountdown = null;
    phase = "loading";
    elapsedSec = 0;
    answers = {};
    render();
    stopElapsed = startElapsedTimer((s) => {
      elapsedSec = s;
      const el = panelEl.querySelector("#quiz-elapsed");
      if (el) el.textContent = String(s);
    });

    const { notes, modelOff, tally } = getState();
    const result = await applyQuiz({
      notes,
      state: { modelOff },
      fetchImpl,
      cache: opts.bypassCache ? bypassCacheOnce(cache) : cache,
      now,
      tally,
    });

    stopElapsed?.();
    stopElapsed = null;

    if (result.status) {
      errorInfo = { code: result.status, retryAfterSec: result.retryAfterSec, detail: result.detail };
      phase = "error";
      render();
      return;
    }

    setTally(result.tally);
    recordSession({ surface: "quiz", counts: result.counts, at: new Date().toISOString() });
    lastSuccess = { questions: result.questions, counts: result.counts, meta: result.meta, source: result.source };
    phase = "result";
    errorInfo = null;
    answers = {};
    render();
  }

  function setReveal() {
    // Quiz has no struck rows in the main list (refused items live inside a closed <details>,
    // and the reveal toggle only concerns already-visible struck text) — nothing to toggle here
    // beyond what a re-render already reflects.
  }

  render();
  return { render, setReveal };
}
