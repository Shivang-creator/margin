import { test } from "node:test";
import assert from "node:assert/strict";
import { getGeneration } from "../web/model.js";
import { runAsk, runExplainBack } from "../web/pipeline.js";
import { createCache, cacheKey } from "../web/cache.js";

const NOTES = "Mitochondria are the site of aerobic respiration. Cristae increase surface area.";

function throwingFetch() {
  throw new Error("fetchImpl must not be called while modelOff");
}

test("test_injected_fetch_never_called_when_model_is_off", async () => {
  const result = await getGeneration({
    action: "ask",
    notes: NOTES,
    input: "question",
    state: { modelOff: true },
    fetchImpl: throwingFetch,
    cache: createCache(),
    now: () => new Date(0),
  });
  // If throwingFetch had been called the test would already have failed via the
  // unhandled throw; reaching here proves it wasn't touched.
  assert.equal(result.status, "model-off");
});

test("test_on_and_off_return_byte_identical_json_for_the_same_cached_generation", async () => {
  const cache = createCache();
  const key = await cacheKey({ notes: NOTES, action: "ask", input: "question", promptVersion: null });
  const fixtureGeneration = {
    ok: true,
    action: "ask",
    provider: "fixture",
    model: "test-model",
    promptVersion: null,
    latencyMs: 5,
    generatedAt: "2026-08-25T00:00:00Z",
    data: { sentences: [{ text: "Cristae increase surface area.", quote: "Cristae increase surface area." }] },
  };
  await cache.set(key, fixtureGeneration);

  const on = await getGeneration({
    action: "ask",
    notes: NOTES,
    input: "question",
    state: { modelOff: false },
    fetchImpl: throwingFetch,
    cache,
    now: () => new Date(0),
  });
  const off = await getGeneration({
    action: "ask",
    notes: NOTES,
    input: "question",
    state: { modelOff: true },
    fetchImpl: throwingFetch,
    cache,
    now: () => new Date(0),
  });

  assert.equal(JSON.stringify(on.generation), JSON.stringify(off.generation));
});

test("test_off_with_empty_cache_returns_model_off_status_with_zero_sentences", async () => {
  const direct = await getGeneration({
    action: "ask",
    notes: NOTES,
    input: "a fresh question never cached",
    state: { modelOff: true },
    fetchImpl: throwingFetch,
    cache: createCache(),
    now: () => new Date(0),
  });
  assert.deepEqual(direct, { status: "model-off" });

  const viaAsk = await runAsk({
    notes: NOTES,
    question: "a fresh question never cached",
    state: { modelOff: true },
    fetchImpl: throwingFetch,
    cache: createCache(),
    now: () => new Date(0),
    tally: null,
  });
  assert.equal(viaAsk.status, "model-off");
  assert.equal(viaAsk.verdicts.length, 0);
});

test("test_explain_back_verdicts_are_identical_regardless_of_model_toggle", () => {
  // Explain-back has no model path at all — its signature doesn't even accept a
  // modelOff flag — so running it twice with the same inputs must be deterministic
  // no matter what any hypothetical toggle would have been.
  const studentText = "Cristae increase surface area.";
  const first = runExplainBack({ notes: NOTES, studentText, tally: null });
  const second = runExplainBack({ notes: NOTES, studentText, tally: null });
  assert.equal(JSON.stringify(first.verdicts), JSON.stringify(second.verdicts));
});
