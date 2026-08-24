import { test } from "node:test";
import assert from "node:assert/strict";
import { splitSentences } from "../core/sentences.js";

test("test_markdown_heading_prefix_stripped_but_offsets_stay_on_original", () => {
  const text = "# Mitochondria\nThey make ATP for the cell.";
  const sentences = splitSentences(text);
  const heading = sentences.find((s) => s.text === "Mitochondria");
  assert.ok(heading, "expected the heading fragment to survive as its own sentence");
  assert.equal(text.slice(heading.start, heading.end), "Mitochondria");
});

test("test_markdown_bullet_prefix_stripped", () => {
  const text = "- The cristae increase surface area.";
  const sentences = splitSentences(text);
  assert.equal(sentences.length, 1);
  assert.equal(sentences[0].text, "The cristae increase surface area.");
  assert.equal(text.slice(sentences[0].start, sentences[0].end), sentences[0].text);
});

test("test_numbered_list_prefix_stripped", () => {
  const text = "1. ATP synthase makes ATP using the gradient.";
  const sentences = splitSentences(text);
  assert.equal(sentences.length, 1);
  assert.equal(sentences[0].text, "ATP synthase makes ATP using the gradient.");
});

test("test_eg_abbreviation_does_not_split_the_sentence", () => {
  const text = "Organelles, e.g. mitochondria, have membranes.";
  const sentences = splitSentences(text);
  assert.equal(sentences.length, 1);
  assert.equal(sentences[0].text, text);
});

test("test_dr_abbreviation_does_not_split_the_sentence", () => {
  const text = "Dr. Smith explained the cristae in detail.";
  const sentences = splitSentences(text);
  assert.equal(sentences.length, 1);
  assert.equal(sentences[0].text, text);
});

test("test_vs_abbreviation_does_not_split_the_sentence", () => {
  const text = "Aerobic vs. anaerobic respiration differ in yield.";
  const sentences = splitSentences(text);
  assert.equal(sentences.length, 1);
});

test("test_single_capital_letter_initial_does_not_split", () => {
  const text = "A. Einstein was born in 1879 and studied physics.";
  const sentences = splitSentences(text);
  assert.equal(sentences.length, 1);
  assert.equal(sentences[0].text, text);
});

test("test_offsets_slice_original_text_exactly_for_every_sentence", () => {
  const text = "Mitochondria are organelles. They make ATP! Do they have DNA?";
  const sentences = splitSentences(text);
  assert.equal(sentences.length, 3);
  for (const s of sentences) {
    assert.equal(text.slice(s.start, s.end), s.text);
  }
});

test("test_fragments_with_zero_content_tokens_are_dropped", () => {
  const text = "The cell.\n\n---\n\nATP is made here.";
  const sentences = splitSentences(text);
  // "---" and the blank line normalise to zero content tokens and must not appear
  assert.ok(!sentences.some((s) => s.text === "---"));
  assert.ok(sentences.some((s) => s.text === "ATP is made here."));
});

test("test_multiple_sentences_on_one_line_split_correctly", () => {
  const text = "Cristae increase surface area. ATP synthase sits in the membrane.";
  const sentences = splitSentences(text);
  assert.equal(sentences.length, 2);
  assert.equal(sentences[0].text, "Cristae increase surface area.");
  assert.equal(sentences[1].text, "ATP synthase sits in the membrane.");
});
