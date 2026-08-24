// R-03 regression: normalize() used to turn `,` and `.` into spaces unconditionally, so
// "16,569" became two number tokens ("16" "569") and "2.5" became two more ("2" "5"). That
// made PLAN §4.2's decimal/thousands-separator handling in numberTokens() dead code: a
// number that only matched *part* of the real figure (e.g. "569") could pass as GROUNDED,
// and the real figure written out without the comma ("16569") could get struck as a
// "different" number. Fixed in core/normalize.js: a comma/period between two digits now
// survives step 3, so numberTokens() (core/tokens.js) sees the whole figure as one token.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalize } from "../core/normalize.js";
import { tokenize, numberTokens } from "../core/tokens.js";
import { runExplainBack } from "../web/pipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const NOTES = fs.readFileSync(path.join(ROOT, "fixtures", "sample-notes.md"), "utf8");

test("test_comma_and_decimal_numbers_are_single_number_tokens", () => {
  const commaNorm = normalize("The human one is 16,569 base pairs long.").norm;
  const commaNumbers = numberTokens(tokenize(commaNorm));
  assert.equal(commaNumbers.length, 1, `expected one number token in ${JSON.stringify(commaNorm)}, got ${JSON.stringify(commaNumbers)}`);
  assert.ok(
    commaNumbers[0] === "16,569" || commaNumbers[0] === "16569",
    `comma number token should be "16,569" or "16569", got ${JSON.stringify(commaNumbers[0])}`
  );

  const decimalNorm = normalize("1 NADH is worth about 2.5 ATP.").norm;
  const decimalNumbers = numberTokens(tokenize(decimalNorm));
  assert.ok(decimalNumbers.includes("2.5"), `expected "2.5" to survive as one token, got ${JSON.stringify(decimalNumbers)}`);
});

test("test_partial_digit_string_no_longer_passes_as_the_full_comma_number", () => {
  // The old bug: normalize split "16,569" into "16" and "569", so a sentence quoting only
  // "569" would content-token-overlap the real note and get struck as GROUNDED by accident.
  const falseMatch = runExplainBack({
    notes: NOTES,
    studentText: "The human mitochondrial genome is 569 base pairs long.",
    tally: null,
  });
  assert.equal(
    falseMatch.verdicts[0].verdict,
    "INVENTED",
    "\"569 base pairs\" must not be GROUNDED against a note that says 16,569 base pairs"
  );

  const realMatch = runExplainBack({
    notes: NOTES,
    studentText: "The human mitochondrial genome is 16,569 base pairs long.",
    tally: null,
  });
  assert.equal(realMatch.verdicts[0].verdict, "GROUNDED", "the real figure, comma and all, must still be GROUNDED");
});
