// Footer "How the Ledger is checked" drawer (DESIGN §5.7, R-09). Pure, DOM-free: takes the
// T-11 calibration fixture + sample notes and a `runExplainBack` implementation, and returns
// rows/totals (runCalibration) or a rendered HTML string for the <details> element
// (calibrationDetailsHTML). No document/window reference — testable with plain node:test,
// and reusable by both the footer (web/main.js) and tests/calibration.test.js.

export function runCalibration({ fixture, notes, runExplainBack }) {
  const rows = fixture.cases.map((c) => {
    const result = runExplainBack({ notes, studentText: c.text, tally: null });
    const v = result.verdicts[0];
    return {
      kind: c.kind,
      label: c.label,
      verdict: v.verdict,
      reason: v.reason,
      text: c.text,
      match: v.verdict === c.label,
    };
  });

  const invented = rows.filter((r) => r.label === "INVENTED");
  const grounded = rows.filter((r) => r.label === "GROUNDED");
  const caught = invented.filter((r) => r.verdict === "INVENTED").length;
  // The false-strike rows: a true (GROUNDED-labelled) sentence the Ledger struck anyway.
  // Rule 8's spotlighted row (DESIGN §5.7) is the first one, if any.
  const falseStrikeRows = grounded.filter((r) => r.verdict === "INVENTED");

  return {
    rows,
    caught,
    invented: invented.length,
    falseStrikes: falseStrikeRows.length,
    grounded: grounded.length,
    spotlight: falseStrikeRows[0] ?? null,
  };
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// calibrationDetailsHTML(result, fixture) -> the <details> markup for the footer, per
// DESIGN §5.7: the 30-row table (kind · labelled · verdict · reason), the totals line
// "caught X/15 · false strikes Y/15" with the pre-registered margin, and — rule 8, the
// visible imperfection — one spotlighted false-strike row with its caption.
export function calibrationDetailsHTML(result, fixture) {
  const { rows, caught, invented, falseStrikes, grounded, spotlight } = result;

  const rowsHTML = rows
    .map((r) => {
      const spotlightClass = spotlight && r === spotlight ? " calibration-row-spotlight" : "";
      return `<tr class="calibration-row${spotlightClass}"><td>${escapeHtml(r.kind)}</td><td>${escapeHtml(r.label)}</td><td>${escapeHtml(r.verdict)}</td><td>${escapeHtml(r.reason)}</td></tr>`;
    })
    .join("");

  const caption = spotlight
    ? `<p class="calibration-spotlight-caption">This true sentence is struck. Heavy paraphrase looks invented to the Ledger — it leans toward doubt, and we left it that way.<br><em>&ldquo;${escapeHtml(spotlight.text)}&rdquo;</em></p>`
    : "";

  return `<details class="calibration"><summary>How the Ledger is checked</summary>
<table class="calibration-table"><thead><tr><th>kind</th><th>labelled</th><th>verdict</th><th>reason</th></tr></thead><tbody>${rowsHTML}</tbody></table>
<p class="calibration-totals">caught ${caught}/${invented} &middot; false strikes ${falseStrikes}/${grounded} <span class="calibration-margin">(pre-registered margin: catch&nbsp;&ge;&nbsp;${fixture.margin.catchAtLeast}, false strike&nbsp;&le;&nbsp;${fixture.margin.falseStrikeAtMost}, threshold ${fixture.threshold})</span></p>
${caption}</details>`;
}
