import { test } from "node:test";
import assert from "node:assert/strict";
import { reduceTally } from "../core/tally.js";

test("test_reduce_tally_accumulates_totals_from_null", () => {
  const next = reduceTally(null, { written: 3, grounded: 2, struck: 1 }, "ask");
  assert.equal(next.written, 3);
  assert.equal(next.grounded, 2);
  assert.equal(next.struck, 1);
});

test("test_reduce_tally_tracks_per_surface_counts", () => {
  const next = reduceTally(null, { written: 3, grounded: 2, struck: 1 }, "quiz");
  assert.deepEqual(next.bySurface.quiz, { written: 3, grounded: 2, struck: 1 });
});

test("test_reduce_tally_does_not_mutate_input_tally", () => {
  const original = { written: 1, grounded: 1, struck: 0, bySurface: { ask: { written: 1, grounded: 1, struck: 0 } } };
  const snapshot = JSON.parse(JSON.stringify(original));
  reduceTally(original, { written: 5, grounded: 0, struck: 5 }, "ask");
  assert.deepEqual(original, snapshot);
});

test("test_reduce_tally_accumulates_across_multiple_calls_on_same_surface", () => {
  let tally = reduceTally(null, { written: 2, grounded: 1, struck: 1 }, "ask");
  tally = reduceTally(tally, { written: 3, grounded: 3, struck: 0 }, "ask");
  assert.deepEqual(tally.bySurface.ask, { written: 5, grounded: 4, struck: 1 });
  assert.equal(tally.written, 5);
});

test("test_reduce_tally_keeps_other_surfaces_untouched", () => {
  let tally = reduceTally(null, { written: 2, grounded: 2, struck: 0 }, "explain-back");
  tally = reduceTally(tally, { written: 4, grounded: 1, struck: 3 }, "quiz");
  assert.deepEqual(tally.bySurface["explain-back"], { written: 2, grounded: 2, struck: 0 });
  assert.deepEqual(tally.bySurface.quiz, { written: 4, grounded: 1, struck: 3 });
  assert.equal(tally.written, 6);
});
