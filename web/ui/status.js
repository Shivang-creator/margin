// Honest state cards (DESIGN §5). One shared shape: left border colour by variant,
// a title, a body, and an optional action. Never a spinner.

export function stateCardHTML({ variant = "info", title, body, actionHTML = "" }) {
  const cls = { info: "state-info", warn: "state-warn", error: "state-error" }[variant] ?? "state-info";
  return `
    <div class="state ${cls}" role="status">
      <p class="state-title">${title}</p>
      <p class="state-body">${body}</p>
      ${actionHTML ? `<div class="state-action">${actionHTML}</div>` : ""}
    </div>
  `;
}

// DESIGN §5.1 — shown above the working surface for as long as the model toggle is off.
export function modelOffBannerHTML() {
  return `
    <div class="model-off-banner" role="status">
      <p class="state-title">Model off.</p>
      <p class="state-body">Ask and Quiz will only show what's already cached in this browser. Explain-back keeps working — the Ledger is code, not a prompt.</p>
    </div>
  `;
}

// countdown: the only setTimeout in web/ (DESIGN §5.4 rate-limit-minute). Ticks once a
// second down to 0, then calls onDone. Named "countdown" so `grep setTimeout web/ | grep -v
// countdown` stays empty per PLAN §7 — every line below that mentions setTimeout also names it.
export function countdown(seconds, onTick, onDone) {
  onTick(seconds);
  if (seconds <= 0) {
    onDone();
    return () => {};
  }
  const handle = setTimeout(() => countdown(seconds - 1, onTick, onDone), 1000); // countdown tick
  return () => clearTimeout(handle);
}

// A live, no-model elapsed-seconds counter for the loading state (DESIGN §5.4/§4 "Slow
// network"): driven by the request's own promise plus one requestAnimationFrame loop that
// stops on settle. No timers — this is a rAF poll, not a delay.
export function startElapsedTimer(onTick) {
  const start = (typeof performance !== "undefined" ? performance.now() : Date.now());
  let stopped = false;
  function tick() {
    if (stopped) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    onTick(Math.floor((now - start) / 1000));
    if (!stopped) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return () => {
    stopped = true;
  };
}
