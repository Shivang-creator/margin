// The one-command proof (PLAN §5): model-on and model-off must produce byte-identical
// Ledger verdicts for the same cached generation, and an empty cache off must be honest
// rather than fabricate. Writes only to tmp/ (never to a shipped path).

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
const isLive = process.argv.includes("--live");

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
  throw new Error("fetchImpl must not be called — the killswitch proves the cached path only");
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });

  if (isLive) {
    console.log("--live is not wired to a real provider in this proof; using the fixture generation.");
  }
  const generation = loadGeneration();

  const key = await cacheKey({ notes: NOTES, action: "ask", input: QUESTION, promptVersion: null });
  const now = () => new Date("2026-08-25T00:00:00Z");

  // (a) model on, served from a cache seeded with the fixture generation.
  const cacheOn = createCache();
  await cacheOn.set(key, generation);
  const on = await runAsk({
    notes: NOTES,
    question: QUESTION,
    state: { modelOff: false },
    fetchImpl: throwingFetch,
    cache: cacheOn,
    now,
    tally: null,
  });
  const onPath = path.join(TMP, "on.json");
  fs.writeFileSync(onPath, JSON.stringify(on.verdicts, null, 2));

  // (b) model off, the same seeded generation — must match (a) exactly.
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

  console.log(`sha256(on.json)  = ${onHash}`);
  console.log(`sha256(off.json) = ${offHash}`);
  console.log(`byte-identical: ${identical ? "yes" : "no"}`);

  process.exit(identical ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
