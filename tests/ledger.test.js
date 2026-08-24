import { test } from "node:test";
import assert from "node:assert/strict";
import { ledger } from "../core/ledger.js";

// The PLAN §4.4 worked-example notes passage, reproduced verbatim.
const NOTES =
  "Mitochondria are the site of aerobic respiration. The inner membrane is folded into cristae, which increase surface area. ATP synthase uses the proton gradient to make ATP. Most of the cell’s ATP — about 90% — is made here.";

test("test_grounded_when_quote_found_with_full_content_overlap", () => {
  const { verdicts } = ledger(NOTES, [
    {
      text: "The inner membrane folds into cristae to increase surface area.",
      quote:
        "The inner membrane is folded into cristae, which increase surface area.",
    },
  ]);
  assert.equal(verdicts[0].verdict, "GROUNDED");
  assert.equal(verdicts[0].reason, "GROUNDED");
  assert.equal(verdicts[0].overlap, 1);
  assert.deepEqual(verdicts[0].span, { start: 50, end: 120 });
});

test("test_invented_no_quote_true_in_world_not_in_notes", () => {
  const { verdicts } = ledger(NOTES, [
    { text: "Mitochondria have their own DNA inherited from the mother.", quote: null },
  ]);
  assert.equal(verdicts[0].verdict, "INVENTED");
  assert.equal(verdicts[0].reason, "NO_QUOTE");
  assert.equal(verdicts[0].span, null);
});

test("test_invented_quote_not_in_notes_fabricated_citation", () => {
  const { verdicts } = ledger(NOTES, [
    { text: "Mitochondria contain circular DNA.", quote: "Mitochondria contain circular DNA" },
  ]);
  assert.equal(verdicts[0].verdict, "INVENTED");
  assert.equal(verdicts[0].reason, "QUOTE_NOT_IN_NOTES");
  assert.equal(verdicts[0].span, null);
});

test("test_invented_low_overlap_when_quote_found_but_off_topic", () => {
  const { verdicts } = ledger(NOTES, [
    {
      text: "Cristae are where the Krebs cycle enzymes are anchored.",
      quote: "The inner membrane is folded into cristae",
    },
  ]);
  assert.equal(verdicts[0].verdict, "INVENTED");
  assert.equal(verdicts[0].reason, "LOW_OVERLAP");
  assert.equal(verdicts[0].overlap, 0.2);
});

test("test_invented_number_not_in_quote_worked_example", () => {
  const { verdicts } = ledger(NOTES, [
    {
      text: "About 60% of the cell's ATP is made here.",
      quote: "about 90% — is made here",
    },
  ]);
  assert.equal(verdicts[0].verdict, "INVENTED");
  assert.equal(verdicts[0].reason, "NUMBER_NOT_IN_QUOTE");
});

test("test_grounded_despite_curly_quotes_dash_and_linebreak_in_quote", () => {
  const { verdicts } = ledger(NOTES, [
    {
      text: "Most of the cell's ATP is made here.",
      quote: "Most of the cell’s ATP —\nabout 90% — is made here.",
    },
  ]);
  assert.equal(verdicts[0].verdict, "GROUNDED");
  assert.equal(verdicts[0].reason, "GROUNDED");
});

test("test_overlap_exactly_at_threshold_is_grounded", () => {
  const notes = "Alpha bravo occurred first in the sequence. Alpha appeared once in the record.";
  const { verdicts } = ledger(notes, [
    { text: "Alpha bravo charlie delta.", quote: "Alpha bravo occurred first in the sequence." },
  ]);
  assert.equal(verdicts[0].overlap, 0.5);
  assert.equal(verdicts[0].verdict, "GROUNDED");
});

test("test_overlap_just_below_threshold_is_invented", () => {
  const notes = "Alpha bravo occurred first in the sequence. Alpha appeared once in the record.";
  const { verdicts } = ledger(notes, [
    { text: "Alpha bravo charlie delta.", quote: "Alpha appeared once in the record." },
  ]);
  assert.equal(verdicts[0].overlap, 0.25);
  assert.equal(verdicts[0].verdict, "INVENTED");
  assert.equal(verdicts[0].reason, "LOW_OVERLAP");
});

test("test_number_mismatch_beats_overlap", () => {
  // All four content words match (overlap would be 1.0 / GROUNDED) but the number
  // in the sentence isn't in the cited quote — rule 3 must fire before rule 4.
  const notes = "The reaction produces 50 grams of product under standard pressure.";
  const { verdicts } = ledger(notes, [
    {
      text: "The reaction produces 90 grams of product.",
      quote: "The reaction produces 50 grams of product under standard pressure.",
    },
  ]);
  assert.equal(verdicts[0].reason, "NUMBER_NOT_IN_QUOTE");
  assert.equal(verdicts[0].verdict, "INVENTED");
});

test("test_quote_too_short_when_below_min_quote_tokens", () => {
  const notes = "The short quote lives right here in the notes.";
  const { verdicts } = ledger(notes, [
    { text: "Something happened.", quote: "quote lives" },
  ]);
  assert.equal(verdicts[0].reason, "QUOTE_TOO_SHORT");
  assert.equal(verdicts[0].verdict, "INVENTED");
});

test("test_empty_quote_string_treated_as_no_quote", () => {
  const { verdicts } = ledger(NOTES, [{ text: "Some claim.", quote: "" }]);
  assert.equal(verdicts[0].reason, "NO_QUOTE");
});

test("test_no_content_sentence_is_invented", () => {
  const { verdicts } = ledger(NOTES, [
    { text: "It is.", quote: "The inner membrane is folded into cristae, which increase surface area." },
  ]);
  assert.equal(verdicts[0].verdict, "INVENTED");
  assert.equal(verdicts[0].reason, "NO_CONTENT");
});

test("test_counts_written_grounded_struck_are_correct", () => {
  const { counts } = ledger(NOTES, [
    {
      text: "The inner membrane folds into cristae to increase surface area.",
      quote: "The inner membrane is folded into cristae, which increase surface area.",
    },
    { text: "Mitochondria have their own DNA inherited from the mother.", quote: null },
    { text: "Mitochondria contain circular DNA.", quote: "Mitochondria contain circular DNA" },
  ]);
  assert.deepEqual(counts, { written: 3, grounded: 1, struck: 2 });
});

test("test_verdict_includes_index_text_and_quote_fields", () => {
  const { verdicts } = ledger(NOTES, [
    { text: "Mitochondria contain circular DNA.", quote: "Mitochondria contain circular DNA" },
  ]);
  assert.equal(verdicts[0].i, 0);
  assert.equal(verdicts[0].text, "Mitochondria contain circular DNA.");
  assert.equal(verdicts[0].quote, "Mitochondria contain circular DNA");
});

test("test_span_recovers_original_notes_offsets_exactly", () => {
  const { verdicts } = ledger(NOTES, [
    {
      text: "The inner membrane folds into cristae to increase surface area.",
      quote: "The inner membrane is folded into cristae, which increase surface area.",
    },
  ]);
  const { start, end } = verdicts[0].span;
  // The trailing period isn't part of the normalised quote, so the recovered span
  // stops right before it.
  assert.equal(
    NOTES.slice(start, end),
    "The inner membrane is folded into cristae, which increase surface area"
  );
});

test("test_multiple_sentences_produce_independent_verdicts", () => {
  const { verdicts } = ledger(NOTES, [
    { text: "Mitochondria contain circular DNA.", quote: "Mitochondria contain circular DNA" },
    {
      text: "The inner membrane folds into cristae to increase surface area.",
      quote: "The inner membrane is folded into cristae, which increase surface area.",
    },
  ]);
  assert.equal(verdicts[0].verdict, "INVENTED");
  assert.equal(verdicts[1].verdict, "GROUNDED");
  assert.equal(verdicts[0].i, 0);
  assert.equal(verdicts[1].i, 1);
});

test("test_case_insensitive_quote_matching_via_normalisation", () => {
  const { verdicts } = ledger(NOTES, [
    {
      text: "The inner membrane folds into cristae to increase surface area.",
      quote: "THE INNER MEMBRANE IS FOLDED INTO CRISTAE, WHICH INCREASE SURFACE AREA.",
    },
  ]);
  assert.equal(verdicts[0].verdict, "GROUNDED");
});

test("test_reason_codes_are_one_of_the_documented_set", () => {
  const DOCUMENTED = new Set([
    "NO_QUOTE",
    "QUOTE_TOO_SHORT",
    "QUOTE_NOT_IN_NOTES",
    "NUMBER_NOT_IN_QUOTE",
    "NO_CONTENT",
    "LOW_OVERLAP",
    "GROUNDED",
  ]);
  const { verdicts } = ledger(NOTES, [
    { text: "Mitochondria contain circular DNA.", quote: "Mitochondria contain circular DNA" },
    {
      text: "The inner membrane folds into cristae to increase surface area.",
      quote: "The inner membrane is folded into cristae, which increase surface area.",
    },
  ]);
  for (const v of verdicts) {
    assert.ok(DOCUMENTED.has(v.reason), `unexpected reason code ${v.reason}`);
  }
});

test("test_plan_accept_criterion_reason_is_number_not_in_quote", () => {
  const { verdicts } = ledger(
    "Most of the cell’s ATP — about 90% — is made here.",
    [{ text: "About 60% of the ATP is made here.", quote: "about 90% — is made here" }]
  );
  assert.equal(verdicts[0].reason, "NUMBER_NOT_IN_QUOTE");
});
