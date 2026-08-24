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
