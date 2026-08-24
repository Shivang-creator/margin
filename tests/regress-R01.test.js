// R-01 regression: web/data/test-results.json (read by the footer and by README's own
// number-tracing rule) was a stale hand-run snapshot ("102/102") committed before T-12/13/14
// landed, while the real suite had grown to 117. Fixed two ways: (1) package.json now runs
// `tools/test-count.js` as npm's `posttest` hook, so every `npm test` regenerates the file —
// it can no longer drift out from under a later commit; (2) this test proves the file
// currently on disk agrees with a fresh, independent TAP run, so a stale file (or a broken
// posttest wiring) fails CI instead of shipping.
//
// This test only reads; it never spawns tools/test-count.js and never writes to web/data/.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

test("test_posttest_hook_regenerates_test_results_json", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(
    pkg.scripts?.posttest,
    "node tools/test-count.js",
    "package.json must run tools/test-count.js as npm's posttest hook, so `npm test` can never leave web/data/test-results.json stale"
  );
});

test("test_test_results_json_total_matches_tap_count", () => {
  const jsonPath = path.join(ROOT, "web", "data", "test-results.json");
  const onDisk = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

  const selfPath = fileURLToPath(import.meta.url);
  const selfBasename = path.basename(selfPath);

  // Spawn every *other* test file (spawning this file too would recurse: this very test
  // would spawn a run of "every test file" that includes itself, spawning again, forever).
  // This file's own test count is added back in below by statically counting its own
  // `test(` calls, so the comparison still covers the whole suite.
  const otherTestFiles = fs
    .readdirSync(path.join(ROOT, "tests"))
    .filter((f) => f.endsWith(".test.js") && f !== selfBasename)
    .map((f) => path.join("tests", f));

  // node:test refuses to run --test recursively when it sees its own NODE_TEST_CONTEXT env
  // var (it prints a warning and silently produces zero output) — this test itself runs
  // under `node --test`, so that var is already set in process.env and would otherwise make
  // the child below a silent no-op. Strip it for the child only.
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;

  const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...otherTestFiles], {
    cwd: ROOT,
    encoding: "utf8",
    env: childEnv,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  const totalMatch = output.match(/^1\.\.(\d+)/m);
  const failMatch = output.match(/^# fail (\d+)/m);
  assert.ok(totalMatch, "expected a TAP plan line (1..N) from a fresh spawn of the suite");

  const otherTotal = Number(totalMatch[1]);
  const liveFail = failMatch ? Number(failMatch[1]) : 0;

  const selfSource = fs.readFileSync(selfPath, "utf8");
  const selfTestCount = (selfSource.match(/^test\(/gm) || []).length;
  const liveTotal = otherTotal + selfTestCount;

  assert.equal(liveFail, 0, "the freshly spawned suite (every file but this one) must be green");
  assert.equal(
    onDisk.total,
    liveTotal,
    `web/data/test-results.json says ${onDisk.total} tests but a fresh run counts ${liveTotal} (${otherTotal} from other files + ${selfTestCount} from this one) — run \`npm run test:count\` (or \`npm test\`, which now does it automatically) before committing`
  );
  assert.equal(onDisk.fail, 0, "web/data/test-results.json must report fail:0");
});
