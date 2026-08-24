// J-04 (POLISH, pc-test-user): the Ask loading state named the primary model
// ("Asking gemini-3.5-flash · 6.5s") even on a request that the server silently answered via
// the daily-quota fallback chain (Featherless/Qwen this run) — a judge glancing at the
// loading label would momentarily believe the wrong model answered. Fixed: the loading label
// never names a model (only the settled result's own chip does, which already read the name
// from the response body, not from /api/health).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(path.resolve(__dirname, ".."), "web", "ui", "ask.js"), "utf8");

test("test_ask_loading_label_never_names_a_specific_model", () => {
  const loadingBlock = src.match(/if \(phase === "loading"\) {[\s\S]*?return;\s*}/);
  assert.ok(loadingBlock, "expected the loading-phase render branch in web/ui/ask.js");
  assert.ok(
    !/getHealthModel\(\)/.test(loadingBlock[0]),
    "the loading title must not read /api/health's primary model name — the server can silently fall back to a different one (J-04)"
  );
  assert.ok(/Asking/.test(loadingBlock[0]), "loading title should still say something is happening");
});
