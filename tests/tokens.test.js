import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize, contentTokens, stem, numberTokens } from "../core/tokens.js";
import { normalize } from "../core/normalize.js";

test("test_tokenize_splits_on_spaces", () => {
  assert.deepEqual(tokenize("the cell wall"), ["the", "cell", "wall"]);
});

test("test_stopwords_dropped_from_content_tokens", () => {
  const tokens = tokenize("the cell is the wall of the plant");
  assert.deepEqual(contentTokens(tokens), ["cell", "wall", "plant"]);
});

test("test_stem_strips_ed_when_length_over_five", () => {
  assert.equal(stem("folded"), "fold");
});

test("test_stem_strips_ing_when_length_over_five", () => {
  assert.equal(stem("folding"), "fold");
});

test("test_stem_ies_becomes_y", () => {
  assert.equal(stem("cities"), "city");
});

test("test_stem_strips_trailing_s_when_length_over_three", () => {
  assert.equal(stem("cells"), "cell");
});

test("test_percent_sign_produces_bare_number_token", () => {
  const { norm } = normalize("about 90% here");
  assert.deepEqual(tokenize(norm), ["about", "90", "here"]);
});

test("test_apostrophe_kept_inside_words_when_tokenized", () => {
  const { norm } = normalize("the cell's wall");
  const tokens = tokenize(norm);
  assert.ok(tokens.includes("cell's"));
});

test("test_short_tokens_dropped_from_content_tokens", () => {
  const tokens = tokenize("an ox is a big animal");
  // "an", "is", "a" are stopwords/short; "ox" is length 2 and content-bearing
  assert.deepEqual(contentTokens(tokens), ["ox", "big", "animal"]);
});

test("test_number_tokens_matches_plain_integers_and_decimals", () => {
  assert.deepEqual(numberTokens(["90", "cells", "3.14", "cell's"]), ["90", "3.14"]);
});
