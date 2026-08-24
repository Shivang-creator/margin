// J-02 regression (pc-test-user): triple-clicking "Check my explanation" on the same,
// unchanged text inflated the session-wide Ledger tally by 1 struck sentence per extra
// click (8 -> 11 in the judge's run for one sentence checked once) — silent, no visible
// sign, so a judge citing "N sentences checked" would be citing an inflated number.
//
// web/ui/explain.js's DOM-manipulating createExplainSurface() can't be unit-tested without a
// browser (this project ships zero dependencies, no jsdom), so the anti-inflation decision
// is pulled out into a pure, exported predicate (`isDuplicateRun`) that runCheck() consults
// before re-tallying. This test proves the predicate directly; a live Playwright repro
// (three rapid clicks -> tally-nums stays "1 struck", not "3") confirmed the wiring during
// debugging.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isDuplicateRun } from "../web/ui/explain.js";

const NOTES = "Mitochondria are the site of aerobic respiration.";

test("test_rapid_check_clicks_on_unchanged_text_do_not_inflate_the_tally", () => {
  const firstRun = { notesAtRun: NOTES, studentText: "Peter Mitchell won the Nobel Prize in 1961." };

  // Same notes, same text -> the exact repro: a second/third click on an unchanged textarea.
  assert.equal(isDuplicateRun(firstRun, NOTES, "Peter Mitchell won the Nobel Prize in 1961."), true);

  // No prior run yet -> never a duplicate (the first Check of a session must always tally).
  assert.equal(isDuplicateRun(null, NOTES, "Peter Mitchell won the Nobel Prize in 1961."), false);

  // The student edited the text before clicking Check again -> a real, new submission.
  assert.equal(isDuplicateRun(firstRun, NOTES, "Peter Mitchell won the Nobel Prize in 1978."), false);

  // The notes changed underneath an unchanged explanation (e.g. loaded a different sample)
  // -> also a real, new submission; the verdicts could differ against the new notes.
  assert.equal(isDuplicateRun(firstRun, "Different notes entirely.", "Peter Mitchell won the Nobel Prize in 1961."), false);
});
