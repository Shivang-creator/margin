import { test } from "node:test";
import assert from "node:assert/strict";
import { bestSpan } from "../core/align.js";

const NOTES =
  "Mitochondria are the site of aerobic respiration. The inner membrane is folded into cristae, which increase surface area. ATP synthase uses the proton gradient to make ATP. Most of the cell’s ATP — about 90% — is made here.";

test("test_highest_overlap_note_sentence_wins", () => {
  const result = bestSpan(NOTES, "Cristae make more surface area.");
  assert.equal(
    result.quote,
    "The inner membrane is folded into cristae, which increase surface area."
  );
  assert.equal(result.overlap, 0.75);
});

test("test_low_overlap_still_returns_the_closest_line", () => {
  const result = bestSpan(NOTES, "Mitochondria are found only in animal cells.");
  assert.equal(result.quote, "Mitochondria are the site of aerobic respiration.");
  assert.equal(result.overlap, 0.25);
});

test("test_tie_breaks_to_the_earliest_note_sentence", () => {
  const notes = "Cats are mammals. Dogs are mammals.";
  const result = bestSpan(notes, "Wolves are mammals.");
  assert.equal(result.quote, "Cats are mammals.");
  assert.deepEqual({ start: result.start, end: result.end }, { start: 0, end: 17 });
});

test("test_empty_notes_returns_null_quote_and_zero_overlap", () => {
  const result = bestSpan("", "Any sentence here.");
  assert.deepEqual(result, { quote: null, start: null, end: null, overlap: 0 });
});

test("test_span_matches_the_returned_quote_text_in_original_notes", () => {
  const result = bestSpan(NOTES, "Cristae make more surface area.");
  assert.equal(NOTES.slice(result.start, result.end), result.quote);
});

test("test_zero_overlap_sentence_still_returns_a_candidate_when_notes_nonempty", () => {
  const notes = "Cats are mammals.";
  const result = bestSpan(notes, "Rockets orbit planets.");
  assert.equal(result.quote, "Cats are mammals.");
  assert.equal(result.overlap, 0);
});
