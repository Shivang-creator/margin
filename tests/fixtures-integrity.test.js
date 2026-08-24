// Fixtures are recorded, not mocked (PLAN §9): real 200 responses, saved once, replayed by the
// dev server and by pipeline.test.js. These tests guard that promise — never a hand-written stub.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const RECORDED_FIXTURES = ["ask-1.json", "ask-2.json", "quiz-1.json"];

test("test_recorded_fixtures_carry_provider_model_and_a_recorded_date", () => {
  for (const name of RECORDED_FIXTURES) {
    const abs = path.join(ROOT, "fixtures", "generations", name);
    assert.ok(fs.existsSync(abs), `missing fixture ${name}`);
    const data = JSON.parse(fs.readFileSync(abs, "utf8"));
    assert.equal(data.ok, true, `${name}: ok !== true`);
    assert.equal(typeof data.provider, "string", `${name}: provider missing`);
    assert.equal(typeof data.model, "string", `${name}: model missing`);
    assert.ok(data.model.length > 0, `${name}: model is empty`);
    assert.equal(typeof data.recordedAt, "string", `${name}: recordedAt missing`);
    assert.ok(!Number.isNaN(Date.parse(data.recordedAt)), `${name}: recordedAt is not a valid date`);
  }
});

test("test_sample_notes_carries_source_and_licence_header", () => {
  const text = fs.readFileSync(path.join(ROOT, "fixtures", "sample-notes.md"), "utf8");
  const head = text.split("\n").slice(0, 8).join("\n");
  assert.match(head, /Source:/);
  assert.match(head, /Licence:/);
});

test("test_no_placeholder_or_fake_tokens_in_recorded_fixtures", () => {
  const forbidden = /\b(PLACEHOLDER|TBD|fake)\b/i;
  for (const name of RECORDED_FIXTURES) {
    const abs = path.join(ROOT, "fixtures", "generations", name);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, "utf8");
    assert.ok(!forbidden.test(text), `${name} contains a placeholder/TBD/fake token`);
  }
});
