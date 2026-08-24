// T-11 calibration harness. Runs the real explain-back pipeline (core/ledger.js
// via web/pipeline.js, zero model, zero network) over 30 hand-labelled sentences
// and prints what actually happened. The margin in the fixture header is
// pre-registered before this file ever ran; this test never enforces it and
// never tunes core/ to make a row pass — a miss is printed and counted, not fixed.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runExplainBack } from "../web/pipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIXTURE_PATH = path.join(ROOT, "fixtures", "labelled", "explain-back-cases.json");
const NOTES_PATH = path.join(ROOT, "fixtures", "sample-notes.md");

function loadFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
}

test("test_calibration_fixture_has_thirty_cases_and_a_preregistered_header", () => {
  const fixture = loadFixture();

  assert.equal(typeof fixture.preRegistered, "string", "header needs a preRegistered date");
  assert.equal(typeof fixture.margin?.catchAtLeast, "number");
  assert.equal(typeof fixture.margin?.falseStrikeAtMost, "number");
  assert.equal(typeof fixture.threshold, "number");

  assert.ok(Array.isArray(fixture.cases), "fixture must carry a cases array");
  assert.equal(fixture.cases.length, 30, "T-11 requires exactly 30 hand-labelled cases");

  for (const c of fixture.cases) {
    assert.equal(typeof c.text, "string");
    assert.ok(c.label === "GROUNDED" || c.label === "INVENTED", `bad label on: ${c.text}`);
    assert.equal(typeof c.kind, "string");
  }

  const grounded = fixture.cases.filter((c) => c.label === "GROUNDED").length;
  const invented = fixture.cases.filter((c) => c.label === "INVENTED").length;
  assert.equal(grounded, 15, "PLAN §4.5 mix is 15 grounded / 15 invented");
  assert.equal(invented, 15, "PLAN §4.5 mix is 15 grounded / 15 invented");
});

test("test_calibrate_runs_the_ledger_over_all_cases_and_prints_the_totals", () => {
  const fixture = loadFixture();
  const notes = fs.readFileSync(NOTES_PATH, "utf8");

  const rows = fixture.cases.map((c) => {
    const result = runExplainBack({ notes, studentText: c.text, tally: null });
    const v = result.verdicts[0];
    return {
      kind: c.kind,
      label: c.label,
      verdict: v.verdict,
      reason: v.reason,
      overlap: Number(v.overlap.toFixed(3)),
      match: v.verdict === c.label ? "match" : "MISS",
      knownMiss: Boolean(c.knownMiss),
      text: c.text,
    };
  });

  console.log("\nkind                label     verdict   reason               overlap  match  text");
  for (const r of rows) {
    console.log(
      `${r.kind.padEnd(19)} ${r.label.padEnd(9)} ${r.verdict.padEnd(9)} ${r.reason.padEnd(20)} ${String(r.overlap).padEnd(8)} ${r.match.padEnd(6)} ${r.text}`
    );
  }

  const invented = rows.filter((r) => r.label === "INVENTED");
  const grounded = rows.filter((r) => r.label === "GROUNDED");
  const caught = invented.filter((r) => r.verdict === "INVENTED").length;
  const falseStrikes = grounded.filter((r) => r.verdict === "INVENTED").length;

  // The line the writeup quotes. Keep it grep-able as a single copyable line.
  console.log(`\ncaught ${caught}/${invented.length}  falseStrikes ${falseStrikes}/${grounded.length}  (margin: catch>=${fixture.margin.catchAtLeast}, falseStrike<=${fixture.margin.falseStrikeAtMost}, threshold ${fixture.threshold})\n`);

  const misses = rows.filter((r) => r.match === "MISS");
  if (misses.length) {
    console.log("misses (printed, not asserted — the margin is published as found, never enforced):");
    for (const m of misses) {
      console.log(`  ${m.knownMiss ? "[pre-registered]" : "[new]"} ${m.kind}: "${m.text}" — expected ${m.label}, got ${m.verdict}/${m.reason}`);
    }
  }

  // This test only proves the tool ran end to end over all 30 rows and produced
  // a verdict for each; the margin and any misses are published above, never asserted.
  assert.equal(rows.length, 30);
});
