import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runExplainBack, runAsk, applyQuiz } from "../web/pipeline.js";
import { createCache, cacheKey } from "../web/cache.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOTES_PATH = path.join(__dirname, "..", "fixtures", "sample-notes.md");
const NOTES = fs.existsSync(NOTES_PATH)
  ? fs.readFileSync(NOTES_PATH, "utf8")
  : "Mitochondria are the site of aerobic respiration. Cristae increase surface area.";

test("test_run_explain_back_grounds_a_sentence_close_to_the_notes", () => {
  const result = runExplainBack({
    notes: NOTES,
    studentText: "Cristae increase the surface area of the inner membrane.",
    tally: null,
  });
  assert.equal(result.verdicts.length, 1);
  assert.equal(result.verdicts[0].verdict, "GROUNDED");
  assert.equal(result.counts.grounded, 1);
  assert.equal(result.tally.bySurface["explain-back"].grounded, 1);
});

test("test_run_explain_back_strikes_an_invented_sentence", () => {
  const result = runExplainBack({
    notes: NOTES,
    studentText: "Mitochondria have four separate membranes surrounding the matrix.",
    tally: null,
  });
  assert.equal(result.verdicts[0].verdict, "INVENTED");
  assert.equal(result.counts.struck, 1);
});

test("test_run_explain_back_reports_missed_note_lines", () => {
  const result = runExplainBack({
    notes: NOTES,
    studentText: "Cristae increase the surface area of the inner membrane.",
    tally: null,
  });
  assert.ok(result.missedLines.length > 0, "notes have far more content than one sentence covers");
});

test("test_run_ask_returns_model_off_status_without_calling_fetch", async () => {
  const fetchImpl = () => {
    throw new Error("fetchImpl must not be called while modelOff and cache is empty");
  };
  const result = await runAsk({
    notes: NOTES,
    question: "How much ATP per glucose?",
    state: { modelOff: true },
    fetchImpl,
    cache: createCache(),
    now: () => new Date("2026-08-25T00:00:00Z"),
    tally: null,
  });
  assert.equal(result.status, "model-off");
  assert.equal(result.verdicts.length, 0);
});

test("test_apply_quiz_grades_questions_via_the_ledger_from_a_seeded_cache", async () => {
  const cache = createCache();
  const key = await cacheKey({ notes: NOTES, action: "quiz", input: undefined, promptVersion: null });
  await cache.set(key, {
    ok: true,
    action: "quiz",
    provider: "fixture",
    model: "test-model",
    promptVersion: null,
    latencyMs: 1,
    generatedAt: "2026-08-25T00:00:00Z",
    data: {
      questions: [
        {
          question: "What do cristae increase?",
          options: ["Surface area", "Volume", "Mass", "Density"],
          answerIndex: 0,
          statement: "Cristae increase the surface area of the inner membrane.",
          quote: "cristae, which increase its surface area",
        },
        {
          question: "How many membranes does a mitochondrion have?",
          options: ["Four", "Three", "Two", "One"],
          answerIndex: 0,
          statement: "Mitochondria have four separate membranes.",
          quote: null,
        },
      ],
    },
  });

  const result = await applyQuiz({
    notes: NOTES,
    state: { modelOff: false },
    fetchImpl: () => {
      throw new Error("fetchImpl must not be called on a cache hit");
    },
    cache,
    now: () => new Date("2026-08-25T00:00:00Z"),
    tally: null,
  });

  assert.equal(result.source, "cached");
  assert.equal(result.questions.length, 2);
  assert.equal(result.questions[1].refused, true);
  assert.equal(result.counts.struck, 1);
});
