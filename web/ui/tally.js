// Tally strip (DESIGN §5.6): always visible, session totals across all surfaces.

export function createTallyStrip({ el, getState, onToggleReveal }) {
  function render() {
    const { tally, reveal } = getState();
    const t = tally ?? { written: 0, grounded: 0, struck: 0 };
    const zero = t.written === 0;

    el.innerHTML = `
      <div class="tally-left">
        <span class="tally-word">Ledger</span>
        <span class="tally-nums">${t.written} <span class="sep">&middot;</span> <span class="g">${t.grounded}</span> grounded <span class="sep">&middot;</span> <span class="k">${t.struck}</span> struck</span>
        ${zero ? '<span class="tally-sub">Nothing checked yet</span>' : ""}
        <span class="chip chip-tag chip-rule" title="Verdict computed by code from your notes. Identical with the model off.">Rule &middot; Ledger v1.0</span>
      </div>
      <div class="tally-right">
        <button type="button" class="switch" id="reveal-switch" role="switch" aria-checked="${reveal ? "true" : "false"}">
          <span class="switch-label">Reveal struck</span>
          <span class="switch-track" aria-hidden="true"></span>
          <span class="switch-word">${reveal ? "on" : "off"}</span>
        </button>
      </div>
      <div class="tally-sub">Counted by code from your notes. Same with the model off.</div>
    `;

    el.querySelector("#reveal-switch").addEventListener("click", () => {
      onToggleReveal(!getState().reveal);
    });
  }

  render();
  return { render };
}
