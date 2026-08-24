// R-05 regression: tools/killswitch.js's ON arm used to seed the cache exactly like the OFF
// arm, so `state.modelOff` was never actually read on either arm and fetchImpl was never
// called on either arm — the "kill the model, verdicts don't change" proof was really just
// "same cache, same output" (closer to f(x)===f(x) than PLAN §5 claims). Fixed: the ON arm
// now runs with an empty cache and a fetchImpl that answers like the live API; the OFF arm
// still seeds the cache and never touches fetchImpl. This test reproduces both arms directly
// (same shape as tools/killswitch.js) and asserts the sources actually differ while the
// verdicts stay byte-identical.

import { test } from "node:test";
import assert from "node:assert/strict";
import { runAsk } from "../web/pipeline.js";
import { createCache, cacheKey } from "../web/cache.js";

const NOTES = "Mitochondria are the site of aerobic respiration. Cristae increase surface area.";
const QUESTION = "What do cristae do?";
const GENERATION = {
  ok: true,
  action: "ask",
  provider: "fixture",
  model: "inline-fixture",
  promptVersion: "1",
  latencyMs: 1,
  generatedAt: "2026-08-25T00:00:00Z",
  data: {
    sentences: [
      { text: "Cristae increase the surface area of the inner membrane.", quote: "cristae, which increase its surface area" },
      { text: "Mitochondria are inherited from the mother.", quote: null },
    ],
  },
};

function throwingFetch() {
  throw new Error("fetchImpl must not be called on the OFF arm");
}

test("test_killswitch_on_arm_is_served_live_and_off_arm_from_cache", async () => {
  const key = await cacheKey({ notes: NOTES, action: "ask", input: QUESTION, promptVersion: null });
  const now = () => new Date("2026-08-25T00:00:00Z");

  let liveFetchCalls = 0;
  const on = await runAsk({
    notes: NOTES,
    question: QUESTION,
    state: { modelOff: false },
    fetchImpl: async () => {
      liveFetchCalls += 1;
      return { ok: true, status: 200, json: async () => GENERATION };
    },
    cache: createCache(),
    now,
    tally: null,
  });

  const cacheOff = createCache();
  await cacheOff.set(key, GENERATION);
  const off = await runAsk({
    notes: NOTES,
    question: QUESTION,
    state: { modelOff: true },
    fetchImpl: throwingFetch,
    cache: cacheOff,
    now,
    tally: null,
  });

  assert.equal(on.source, "live", "the ON arm must genuinely go through the fetch path");
  assert.equal(liveFetchCalls, 1, "the ON arm's fetchImpl must actually be called once");
  assert.equal(off.source, "cached", "the OFF arm must be served from cache, never fetch");
  assert.deepEqual(on.verdicts, off.verdicts, "same generation through two different code paths must yield byte-identical verdicts");
});
