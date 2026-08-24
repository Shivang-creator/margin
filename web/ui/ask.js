// Ask surface (DESIGN §5.4). question -> web/model.js (cache? off? live) -> core/ledger,
// via web/pipeline.runAsk. Every honest state from PLAN §6 gets its own card; the previous
// result never disappears, it just sits under the new card at 60% opacity.

import { runAsk } from "../pipeline.js";
import { splitSentences } from "../../core/sentences.js";
import { sentenceListHTML, runLineHTML, mountStrikes, escapeHTML } from "./sentence.js";
import { stateCardHTML, countdown, startElapsedTimer } from "./status.js";

const PROMPT = "Ask anything about the page. Every sentence in the answer has to cite a line, and code checks it.";
const MAX_LEN = 500;

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

export function createAskSurface({
  panelEl,
  getState,
  setTally,
  recordSession,
  notesPane,
  notesDisabledReason,
  getHealthModel,
  fetchImpl,
  cache,
  now,
  onSentenceActivated,
  onTurnModelOn,
}) {
  let phase = "empty"; // empty | loading | error | result
  let lastSuccess = null; // { question, verdicts, counts, meta, source }
  let errorInfo = null; // { code, detail, retryAfterSec }
  let stopElapsed = null;
  let stopCountdown = null;
  let elapsedSec = 0;
  let cachedList = null; // set while showing the "cached answers" filtered view
  const history = []; // {question, verdicts, counts, meta, source, at} — every successful run

  function currentQuestionValue() {
    return panelEl.querySelector("#ask-input")?.value ?? "";
  }

  function render() {
    const disabledReason = notesDisabledReason();
    const question = currentQuestionValue();
    const modelOff = getState().modelOff;
    const submitDisabled = phase === "loading" || Boolean(disabledReason) || question.trim().length === 0;

    panelEl.innerHTML = `
      <div class="surface" id="ask-surface">
        <p class="prompt-line">${PROMPT}</p>
        <input type="text" id="ask-input" maxlength="${MAX_LEN}" placeholder="Ask a question…"
          value="${escapeHTML(question)}" ${disabledReason ? "disabled" : ""} />
        <p class="surface-hint" id="ask-counter"></p>
        <div class="surface-actions">
          <button type="button" class="btn btn-primary" id="ask-btn" ${submitDisabled ? "disabled" : ""}>${
            phase === "loading" ? "Asking…" : "Ask"
          }</button>
          ${disabledReason ? `<span class="disabled-reason">${disabledReason}</span>` : ""}
        </div>
        <div class="result-region" id="ask-result" aria-live="polite"></div>
      </div>
    `;

    const input = panelEl.querySelector("#ask-input");
    const counter = panelEl.querySelector("#ask-counter");
    function syncCounter() {
      const len = input.value.length;
      counter.textContent = len >= 400 ? `${len} / ${MAX_LEN}` : "";
      panelEl.querySelector("#ask-btn").disabled =
        phase === "loading" || Boolean(notesDisabledReason()) || input.value.trim().length === 0;
    }
    syncCounter();
    input.addEventListener("input", syncCounter);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });
    panelEl.querySelector("#ask-btn").addEventListener("click", submit);

    renderResultRegion();
  }

  function previousResultHTML() {
    if (!lastSuccess) return "";
    return `<div class="result-region stale"><p class="result-stale-label">Previous answer</p>${successBodyHTML(lastSuccess)}</div>`;
  }

  function successBodyHTML(entry) {
    const { verdicts, counts, meta, source } = entry;
    const noteSentences = splitSentences(getState().notes ?? "");
    const isCached = source === "cached";
    const chip = isCached
      ? `<span class="chip chip-tag chip-gen" title="A generated result stored earlier in this browser.">Cached &middot; <span class="time">${hhmm(
          meta?.generatedAt
        )}</span></span>`
      : `<span class="chip chip-tag chip-gen" title="Text the model wrote. Always checked, never trusted.">Generated &middot; ${escapeHTML(
          meta?.model ?? "model"
        )}</span>`;
    const fixtureChip =
      meta?.provider === "fixture"
        ? `<span class="chip chip-tag chip-fixture" title="Recorded response replayed by the dev server. Impossible in production.">Fixture &middot; localhost</span>`
        : "";
    const latency = !isCached && typeof meta?.latencyMs === "number" ? `<span class="surface-hint">${(meta.latencyMs / 1000).toFixed(1)} s</span>` : "";
    const subText = isCached
      ? '<p class="surface-hint">Stored in this browser when you asked before. Nothing was sent.</p>'
      : "";
    const askAgain =
      isCached && !getState().modelOff
        ? `<div class="surface-actions"><button type="button" class="btn" id="ask-again-live">Ask again live</button></div>`
        : "";

    return `
      <div class="run-line">
        ${runLineHTML(counts)}
        <span>${chip} ${fixtureChip} ${latency}</span>
      </div>
      ${subText}
      <ul class="sentence-list ${getState().reveal ? "reveal" : ""}" id="ask-sentence-list">
        ${sentenceListHTML(verdicts, { isStudent: false, noteSentences })}
      </ul>
      ${askAgain}
    `;
  }

  function cachedListHTML() {
    const cachedRuns = history.filter((h) => h.source === "cached" || h.meta);
    if (cachedRuns.length === 0) {
      return stateCardHTML({ variant: "info", title: "No cached answers yet.", body: "Answers you've asked before will show up here." });
    }
    return `
      <div class="missed">
        <h3>Cached answers this session</h3>
        <ul>
          ${cachedRuns
            .map(
              (h, i) =>
                `<li><button type="button" data-cached-index="${i}">${escapeHTML(h.question)} — ${h.counts.grounded} grounded &middot; ${h.counts.struck} struck</button></li>`
            )
            .join("")}
        </ul>
      </div>`;
  }

  function renderResultRegion() {
    const region = panelEl.querySelector("#ask-result");
    if (!region) return;

    if (cachedList) {
      region.className = "result-region";
      region.innerHTML = cachedListHTML();
      region.querySelectorAll("[data-cached-index]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const entry = history.filter((h) => h.source === "cached" || h.meta)[Number(btn.dataset.cachedIndex)];
          if (entry) {
            lastSuccess = entry;
            phase = "result";
            cachedList = null;
            renderResultRegion();
          }
        });
      });
      return;
    }

    if (phase === "empty") {
      region.className = "result-region";
      region.innerHTML = '<p class="empty-note">No questions yet.</p>';
      return;
    }

    if (phase === "loading") {
      region.className = "result-region";
      // J-04: this used to name the primary model (from /api/health) while the request was
      // still in flight — but the server can silently fall back to a different model on a
      // daily-quota 429, and the loading label named the wrong one for the whole request
      // (a judge would momentarily believe Gemini answered when it was actually Featherless).
      // The only model name we can trust is the one the *response* names, so the loading
      // state never guesses.
      region.innerHTML =
        stateCardHTML({
          variant: "info",
          title: `Asking&hellip; &middot; <span id="ask-elapsed">${elapsedSec}</span> s`,
          body: "Answers take 2–10 s. The server gives up at 20 s and says so.",
        }) + previousResultHTML();
      return;
    }

    if (phase === "result") {
      region.className = "result-region";
      region.innerHTML = successBodyHTML(lastSuccess);
      mountStrikes(region.querySelector("#ask-sentence-list"));
      attachRowHandlers(region, lastSuccess.verdicts);
      region.querySelector("#ask-again-live")?.addEventListener("click", () => submit({ bypassCache: true }));
      return;
    }

    if (phase === "error") {
      region.className = "result-region";
      region.innerHTML = errorCardHTML() + previousResultHTML();
      wireErrorActions(region);
      if (lastSuccess) {
        mountStrikes(region.querySelector("#ask-sentence-list"));
        attachRowHandlers(region, lastSuccess.verdicts);
      }
    }
  }

  function errorCardHTML() {
    const { code, detail, retryAfterSec } = errorInfo ?? {};
    switch (code) {
      case "model-off":
        return stateCardHTML({
          variant: "warn",
          title: "Model off — nothing cached for this question.",
          body: "Turn the model on to ask this, or ask a question you've asked before. Explain-back doesn't need the model.",
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
          actionHTML: '<button type="button" class="btn" id="err-show-cached">Show cached answers</button>',
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
    region.querySelector("#err-show-cached")?.addEventListener("click", () => {
      cachedList = true;
      renderResultRegion();
    });
    if (errorInfo?.code === "rate-limit-minute") {
      const titleEl = region.querySelector("#rl-title");
      const btn = panelEl.querySelector("#ask-btn");
      if (btn) btn.disabled = true;
      stopCountdown?.();
      stopCountdown = countdown(
        errorInfo.retryAfterSec ?? 30,
        (s) => {
          if (titleEl) titleEl.textContent = s > 0 ? `Rate limited — try again in ${s} s` : "You can ask again.";
        },
        () => {
          if (btn) btn.disabled = Boolean(notesDisabledReason()) || currentQuestionValue().trim().length === 0;
        }
      );
    }
  }

  let healthModels = null;
  function getHealthModels() {
    return healthModels;
  }

  async function submit(opts = {}) {
    const question = currentQuestionValue();
    if (!question.trim() || notesDisabledReason()) return;
    stopCountdown?.();
    stopCountdown = null;

    phase = "loading";
    elapsedSec = 0;
    render();
    stopElapsed = startElapsedTimer((s) => {
      elapsedSec = s;
      const el = panelEl.querySelector("#ask-elapsed");
      if (el) el.textContent = String(s);
    });

    const { notes, modelOff, tally } = getState();
    const result = await runAsk({
      notes,
      question,
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
    recordSession({ surface: "ask", counts: result.counts, at: new Date().toISOString() });
    lastSuccess = { question, verdicts: result.verdicts, counts: result.counts, meta: result.meta, source: result.source };
    history.push({ ...lastSuccess, at: new Date().toISOString() });
    phase = "result";
    errorInfo = null;
    render();
    notesPane.applyVerdicts(result.verdicts, { isStudent: false });
  }

  function attachRowHandlers(region, verdicts) {
    region.querySelectorAll(".sentence-text").forEach((btn) => {
      const v = verdicts[Number(btn.dataset.sentence)];
      if (!v) return;
      const activate = () => {
        if (v.verdict === "GROUNDED") {
          notesPane.setActiveSentence(btn.dataset.sentence);
          notesPane.setActiveByLineStart(null);
          notesPane.clearAbsence();
        } else if (v.span) {
          notesPane.setActiveSentence(null);
          notesPane.setActiveByLineStart(v.span.start);
          notesPane.setAbsence(
            v.reason === "NUMBER_NOT_IN_QUOTE" ? "Cited line found. The number isn't in it." : "Cited line found. The sentence says more than it."
          );
        } else {
          notesPane.setActiveSentence(null);
          notesPane.setActiveByLineStart(null);
          notesPane.setAbsence(
            v.reason === "QUOTE_NOT_IN_NOTES"
              ? `Searched your notes for "${(v.quote ?? "").slice(0, 50)}" — not found.`
              : "Nothing cited for this sentence — nothing to look for."
          );
        }
      };
      const deactivate = () => {
        notesPane.setActiveSentence(null);
        notesPane.setActiveByLineStart(null);
        notesPane.clearAbsence();
      };
      btn.addEventListener("mouseenter", activate);
      btn.addEventListener("mouseleave", deactivate);
      btn.addEventListener("focus", activate);
      btn.addEventListener("blur", deactivate);
      btn.addEventListener("click", () => {
        activate();
        const scrollTarget = v.verdict === "GROUNDED" && v.span ? v.span.start : v.span?.start;
        const doScroll = () => {
          if (scrollTarget != null) notesPane.scrollToOffset(scrollTarget);
        };
        const handled = onSentenceActivated?.(doScroll);
        if (!handled) doScroll();
      });
    });
  }

  function setReveal() {
    const list = panelEl.querySelector("#ask-sentence-list");
    if (list) list.classList.toggle("reveal", Boolean(getState().reveal));
  }

  function setHealthModels(models) {
    healthModels = models;
  }

  render();
  return { render, setReveal, setHealthModels };
}
