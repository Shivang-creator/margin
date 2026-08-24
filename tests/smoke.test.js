import { test } from "node:test";
import assert from "node:assert/strict";
import { LEDGER_VERSION, OVERLAP_THRESHOLD, MIN_QUOTE_TOKENS, MAX_NOTES_CHARS } from "../core/constants.js";

test("test_constants_are_defined", () => {
  assert.equal(LEDGER_VERSION, "1.0");
  assert.equal(OVERLAP_THRESHOLD, 0.5);
  assert.equal(MIN_QUOTE_TOKENS, 3);
  assert.equal(MAX_NOTES_CHARS, 20000);
});
