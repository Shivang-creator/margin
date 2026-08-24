// The deterministic boundary, enforced by reading source files as text (PLAN §3.2).
// Passes trivially while web/pipeline.js, model.js, cache.js, state.js don't exist yet (T-03);
// bites for real once T-08 lands them.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function listJsFiles(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listJsFiles(rel));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      out.push(rel);
    }
  }
  return out;
}

function importSpecifiers(text) {
  const specs = [];
  const importRe = /import\s+(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']/g;
  const exportFromRe = /export\s+(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']/g;
  for (const re of [importRe, exportFromRe]) {
    let m;
    while ((m = re.exec(text))) specs.push(m[1]);
  }
  return specs;
}

const FORBIDDEN_TOKENS = [
  "fetch",
  "window",
  "document",
  "localStorage",
  "XMLHttpRequest",
  "process",
  "Math.random",
  "require(",
];

test("test_core_imports_no_forbidden_tokens_or_paths_outside_core", () => {
  const files = listJsFiles("core");
  assert.ok(files.length > 0, "expected at least one file under core/");
  for (const rel of files) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    for (const token of FORBIDDEN_TOKENS) {
      assert.ok(
        !text.includes(token),
        `${rel} contains forbidden token "${token}"`
      );
    }
    for (const spec of importSpecifiers(text)) {
      assert.ok(
        spec.startsWith("./"),
        `${rel} imports "${spec}" — core may only import "./" within core`
      );
    }
  }
});

test("test_orchestration_files_are_dom_free", () => {
  const orchestrationFiles = [
    "web/pipeline.js",
    "web/model.js",
    "web/cache.js",
    "web/state.js",
  ];
  let checked = 0;
  for (const rel of orchestrationFiles) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    checked += 1;
    const text = fs.readFileSync(abs, "utf8");
    assert.ok(!/\bdocument\b/.test(text), `${rel} references document`);
    assert.ok(!/\bwindow\b/.test(text), `${rel} references window`);
  }
  // Trivially true until T-08 lands these files; still runs so it bites once they exist.
  assert.ok(checked >= 0);
});

test("test_presentation_never_imports_api", () => {
  const files = [...listJsFiles("web/ui")];
  const mainJs = "web/main.js";
  if (fs.existsSync(path.join(ROOT, mainJs))) files.push(mainJs);
  for (const rel of files) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.ok(!text.includes("../api"), `${rel} imports ../api`);
  }
});

test("test_api_never_imports_web_or_core", () => {
  const files = listJsFiles("api");
  for (const rel of files) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.ok(!text.includes("../web"), `${rel} imports ../web`);
    assert.ok(!text.includes("../core"), `${rel} imports ../core`);
    // Relative only ("./" for a sibling, "../" for a parent within api/ — e.g.
    // api/providers/gemini.js reaching api/prompts.js) — never a bare specifier that could
    // resolve to a dependency, and never anything that climbs out of api/ itself (checked above:
    // the only two directories api/ has siblings with are web/ and core/, both explicitly barred).
    for (const spec of importSpecifiers(text)) {
      assert.ok(
        spec.startsWith("./") || spec.startsWith("../"),
        `${rel} imports "${spec}" — api may only import relative paths within api`
      );
    }
  }
});
