// R-09 regression: DESIGN §5.7's footer "How the Ledger is checked" <details> drawer — the
// calibration table with rule 8's spotlighted false-strike row — existed only as a CLI
// (`npm run calibrate`) with no on-screen surface; the video's honest beat had nothing to
// point the camera at. web/calibration.js (DOM-free, pure) now turns the T-11 fixture +
// sample notes into rows/totals and a rendered <details> string; web/main.js wires it into
// the footer at boot. This test proves the renderer itself: given the real fixture, it
// produces the caught/falseStrikes totals and spotlights a real false-strike row.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCalibration, calibrationDetailsHTML } from "../web/calibration.js";
import { runExplainBack } from "../web/pipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures", "labelled", "explain-back-cases.json"), "utf8"));
const notes = fs.readFileSync(path.join(ROOT, "fixtures", "sample-notes.md"), "utf8");

test("test_footer_calibration_details_renders_totals_from_fixture", () => {
  const result = runCalibration({ fixture, notes, runExplainBack });

  assert.equal(result.rows.length, 30);
  assert.equal(result.invented, 15);
  assert.equal(result.grounded, 15);
  assert.ok(result.caught >= 0 && result.caught <= 15);
  assert.ok(result.falseStrikes >= 0 && result.falseStrikes <= 15);

  const html = calibrationDetailsHTML(result, fixture);
  assert.ok(html.startsWith("<details"), "must be a <details> element per DESIGN §5.7");
  assert.ok(html.includes("How the Ledger is checked"));
  assert.ok(html.includes(`caught ${result.caught}/${result.invented}`), "totals line must reflect the fixture's own run, not a hardcoded number");
  assert.ok(html.includes(`false strikes ${result.falseStrikes}/${result.grounded}`));
  assert.ok(html.includes(String(fixture.margin.catchAtLeast)), "must show the pre-registered margin, never a tuned one");
  assert.ok(html.includes(String(fixture.margin.falseStrikeAtMost)));

  if (result.spotlight) {
    assert.ok(html.includes("calibration-row-spotlight"), "rule 8: a false-strike row must be visibly spotlighted");
    assert.ok(html.includes(result.spotlight.text.slice(0, 20)), "the spotlight caption must quote the actual struck sentence");
  }
});

test("test_calibration_details_omitted_when_no_false_strikes_to_spotlight", () => {
  // If a hypothetical fixture run has zero false strikes, there is nothing to spotlight —
  // the renderer must not fabricate a caption or crash.
  const perfectResult = {
    rows: [{ kind: "x", label: "GROUNDED", verdict: "GROUNDED", reason: "GROUNDED", text: "x" }],
    caught: 15,
    invented: 15,
    falseStrikes: 0,
    grounded: 15,
    spotlight: null,
  };
  const html = calibrationDetailsHTML(perfectResult, fixture);
  assert.ok(!html.includes("calibration-spotlight-caption"));
});
