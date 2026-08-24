// One live Gemini call, saved verbatim as a fixture. Usage:
//   node tools/record-generation.js <action:ask|quiz> <input> <out.json>
// <input> is the question text for "ask" (ignored, pass "" for "quiz"). Notes are always the full
// text of fixtures/sample-notes.md — that's the corpus every fixture is recorded against (T-09).
// Never fabricates: on any failure this prints the error and writes nothing.
// Never logs the key.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generate as geminiGenerate } from "../api/providers/gemini.js";
import { PROMPT_VERSION } from "../api/prompts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  const [, , action, input, outPath] = process.argv;

  if (action !== "ask" && action !== "quiz") {
    console.error('usage: node tools/record-generation.js <ask|quiz> <input> <out.json>');
    process.exitCode = 1;
    return;
  }
  if (!outPath) {
    console.error("missing <out.json> argument");
    process.exitCode = 1;
    return;
  }

  loadEnvFile(path.join(ROOT, ".env.local"));

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not set in .env.local — nothing recorded");
    process.exitCode = 1;
    return;
  }
  if (!model) {
    console.error("GEMINI_MODEL not set in .env.local — nothing recorded");
    process.exitCode = 1;
    return;
  }

  const notes = fs.readFileSync(path.join(ROOT, "fixtures", "sample-notes.md"), "utf8");

  console.log(JSON.stringify({ recording: { action, model } }));

  const started = Date.now();
  const result = await geminiGenerate({
    action,
    notes,
    input: action === "ask" ? input : undefined,
    model,
    apiKey,
    fetchImpl: fetch,
    timeoutMs: 20000,
  });
  const latencyMs = result.latencyMs ?? Date.now() - started;

  console.log(JSON.stringify({ provider: "gemini", model, status: result.ok ? "ok" : result.code, latencyMs }));

  if (!result.ok) {
    console.error(`live call failed: ${result.code}${result.detail ? " — " + result.detail : ""} — nothing recorded`);
    process.exitCode = 1;
    return;
  }

  const envelope = {
    ok: true,
    action,
    provider: "gemini",
    model,
    promptVersion: PROMPT_VERSION,
    latencyMs,
    generatedAt: new Date().toISOString(),
    recordedAt: new Date().toISOString(),
    data: result.data,
  };

  const absOut = path.resolve(ROOT, outPath);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  // Compact, no pretty-print spacing: keeps `"provider":"gemini"` etc. grep-able as an exact
  // substring (T-09 accept check), and this file is read by tooling, not humans.
  fs.writeFileSync(absOut, JSON.stringify(envelope) + "\n");
  console.log(`wrote ${path.relative(ROOT, absOut)}`);
}

main().catch((err) => {
  console.error("unexpected error — nothing recorded:", err && err.message ? err.message : err);
  process.exitCode = 1;
});
