import { test } from "node:test";
import assert from "node:assert/strict";
import { missed } from "../core/missed.js";
import { splitSentences } from "../core/sentences.js";

const NOTES = "Cats are mammals. Dogs are reptiles. Birds can fly.";

test("test_uncovered_note_sentences_are_returned", () => {
  const noteSentences = splitSentences(NOTES);
  const verdicts = [{ verdict: "GROUNDED", span: noteSentences[0] }];
  const result = missed(NOTES, verdicts);
  assert.deepEqual(
    result.map((s) => s.text),
    ["Dogs are reptiles.", "Birds can fly."]
  );
});

test("test_fully_covered_notes_return_empty_missed_list", () => {
  const noteSentences = splitSentences(NOTES);
  const verdicts = noteSentences.map((span) => ({ verdict: "GROUNDED", span }));
  assert.deepEqual(missed(NOTES, verdicts), []);
});

test("test_coverage_is_judged_by_span_not_by_matching_text", () => {
  // A grounded verdict whose span is only a sub-span of the note sentence still
  // counts as coverage, because coverage is a span-overlap test, not text equality.
  const noteSentences = splitSentences(NOTES);
  const first = noteSentences[0]; // "Cats are mammals." start 0 end 17
  const subSpan = { start: first.start, end: first.start + 4 }; // "Cats"
  const verdicts = [{ verdict: "GROUNDED", span: subSpan }];
  const result = missed(NOTES, verdicts);
  assert.ok(!result.some((s) => s.text === "Cats are mammals."));
});

test("test_non_grounded_verdicts_do_not_count_as_coverage", () => {
  const noteSentences = splitSentences(NOTES);
  const verdicts = [{ verdict: "INVENTED", span: noteSentences[0] }];
  const result = missed(NOTES, verdicts);
  assert.ok(result.some((s) => s.text === "Cats are mammals."));
});

test("test_verdicts_with_null_span_are_ignored_for_coverage", () => {
  const verdicts = [{ verdict: "GROUNDED", span: null }];
  const result = missed(NOTES, verdicts);
  assert.equal(result.length, 3);
});
