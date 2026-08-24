// The one-command proof (PLAN §5): model-on and model-off must produce byte-identical
// Ledger verdicts for the same generation, and an empty cache off must be honest rather
// than fabricate. Writes only to tmp/ (never to a shipped path).
//
// R-05 fix: the ON arm used to seed the cache exactly like the OFF arm, so it never
// actually read `state.modelOff` or went near fetchImpl — it was a cache hit dressed up
// as "model on" (closer to f(x)===f(x) than PLAN §5's claim). The ON arm now runs with an
// *empty* cache and a `fetchImpl` that returns the fixture generation as a live HTTP
// response, so it genuinely exercises the fetch path (`on.source` is asserted "live"); the
// OFF arm still seeds the cache and never touches fetchImpl (`off.source` is asserted
// "cached"). `--live` (which printed "not wired to a real provider") is removed — this IS
// the real proof now.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { runAsk } from "../web/pipeline.js";
import { createCache, cacheKey } from "../web/cache.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, "tmp");

const NOTES_PATH = path.join(ROOT, "fixtures", "sample-notes.md");
const NOTES = fs.existsSync(NOTES_PATH)
  ? fs.readFileSync(NOTES_PATH, "utf8")
  : "Mitochondria are the site of aerobic respiration. Cristae increase surface area.";

const FIXTURE_PATH = path.join(ROOT, "fixtures", "generations", "ask-1.json");
const QUESTION = "What do cristae do?";

function inlineGeneration() {
  return {
    ok: true,
    action: "ask",
    provider: "fixture",
    model: "inline-fixture",
    promptVersion: "1",
    latencyMs: 1,
    generatedAt: "2026-08-25T00:00:00Z",
    data: {
      sentences: [
        {
          text: "Cristae increase the surface area of the inner membrane.",
          quote: "cristae, which increase its surface area",
        },
        { text: "Mitochondria are inherited from the mother.", quote: null },
      ],
    },
  };
}

function loadGeneration() {
  if (fs.existsSync(FIXTURE_PATH)) {
    return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
  }
  return inlineGeneration();
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function throwingFetch() {
  throw new Error("fetchImpl must not be called — the OFF arm proves the cached path only");
}

// The ON arm's fetchImpl: a real HTTP-response shape (ok/status/json()) carrying the same
// generation the OFF arm reads from its cache, so both arms feed the identical model output
// into the identical ledger() call — through genuinely different code paths.
function liveFetchReturning(generation) {
  let calls = 0;
  return async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => generation };
  };
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });

  const generation = loadGeneration();

  const key = await cacheKey({ notes: NOTES, action: "ask", input: QUESTION, promptVersion: null });
  const now = () => new Date("2026-08-25T00:00:00Z");

  // (a) model ON: empty cache, real fetch path, fetchImpl answers like the live API would.
  const on = await runAsk({
    notes: NOTES,
    question: QUESTION,
    state: { modelOff: false },
    fetchImpl: liveFetchReturning(generation),
    cache: createCache(),
    now,
    tally: null,
  });
  if (on.source !== "live") {
    console.error(`expected the ON arm to be served live, got source=${on.source}`);
    process.exit(1);
  }
  const onPath = path.join(TMP, "on.json");
  fs.writeFileSync(onPath, JSON.stringify(on.verdicts, null, 2));

  // (b) model OFF: cache seeded with the same generation, throwing fetchImpl — must never
  // be called, and must produce byte-identical verdicts to the live ON arm.
  const cacheOff = createCache();
  await cacheOff.set(key, generation);
  const off = await runAsk({
    notes: NOTES,
    question: QUESTION,
    state: { modelOff: true },
    fetchImpl: throwingFetch,
    cache: cacheOff,
    now,
    tally: null,
  });
  if (off.source !== "cached") {
    console.error(`expected the OFF arm to be served from cache, got source=${off.source}`);
    process.exit(1);
  }
  const offPath = path.join(TMP, "off.json");
  fs.writeFileSync(offPath, JSON.stringify(off.verdicts, null, 2));

  // (c) model off, empty cache — the honest state. Nothing fabricates.
  const empty = await runAsk({
    notes: NOTES,
    question: "a question that was never cached",
    state: { modelOff: true },
    fetchImpl: throwingFetch,
    cache: createCache(),
    now,
    tally: null,
  });
  console.log(JSON.stringify({ status: empty.status, sentences: empty.verdicts }));

  // (d) diff + sha256.
  const onText = fs.readFileSync(onPath, "utf8");
  const offText = fs.readFileSync(offPath, "utf8");
  const onHash = sha256(onText);
  const offHash = sha256(offText);
  const identical = onText === offText;

  console.log(`on.source  = ${on.source}`);
  console.log(`off.source = ${off.source}`);
  console.log(`sha256(on.json)  = ${onHash}`);
  console.log(`sha256(off.json) = ${offHash}`);
  console.log(`byte-identical: ${identical ? "yes" : "no"}`);

  process.exit(identical ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
