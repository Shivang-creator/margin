import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, spanFor } from "../core/normalize.js";

test("test_smart_quotes_normalise_to_straight", () => {
  const { norm } = normalize("The cell’s wall, ‘so-called,’ is thick.");
  assert.ok(norm.includes("cell's"));
  assert.ok(!norm.includes("’"));
});

test("test_curly_double_quotes_normalise_to_space_boundaries", () => {
  const { norm } = normalize('She said “stop” now.');
  assert.equal(norm, "she said stop now");
});

test("test_em_dash_normalises_and_becomes_word_boundary", () => {
  const { norm } = normalize("90% — is made here");
  assert.equal(norm, "90 is made here");
});

test("test_nbsp_normalises_to_space", () => {
  const { norm } = normalize("cell wall");
  assert.equal(norm, "cell wall");
});

test("test_newline_and_tab_collapse_to_single_space", () => {
  const { norm } = normalize("line one\n\tline two");
  assert.equal(norm, "line one line two");
});

test("test_offset_map_round_trip_recovers_original_span", () => {
  const original = "Hello World";
  const { norm, map } = normalize(original);
  assert.equal(norm, "hello world");
  const span = spanFor(map, 0, 5); // "hello"
  assert.deepEqual(span, { start: 0, end: 5 });
  assert.equal(original.slice(span.start, span.end), "Hello");
});

test("test_capital_i_with_dot_above_keeps_offsets_aligned", () => {
  const original = "İstanbul is old";
  const { norm, map } = normalize(original);
  assert.equal(norm.length, map.length);
  // whatever normalize does with İ, every norm char maps back into original bounds
  for (const idx of map) {
    assert.ok(idx >= 0 && idx < original.length);
  }
});

test("test_percent_and_punctuation_become_space", () => {
  const { norm } = normalize("about 90%, roughly!");
  assert.equal(norm, "about 90 roughly");
});

test("test_apostrophe_kept_between_letters", () => {
  const { norm } = normalize("the cell's wall");
  assert.ok(norm.includes("cell's"));
});

test("test_apostrophe_dropped_when_not_between_letters", () => {
  const { norm } = normalize("quote 'word' here");
  assert.equal(norm, "quote word here");
});

test("test_worked_example_from_plan_matches_exactly", () => {
  const { norm, map } = normalize("The cell’s\n ATP — 90%");
  assert.equal(norm, "the cell's atp 90");
  assert.equal(map.length, norm.length);
});
