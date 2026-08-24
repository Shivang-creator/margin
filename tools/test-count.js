// Runs the suite with the TAP reporter, parses "1..N" and "# pass"/"# fail", and
// writes the single source of truth the footer reads: web/data/test-results.json.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TESTS_DIR = path.join(ROOT, "tests");

const testFiles = fs
  .readdirSync(TESTS_DIR)
  .filter((f) => f.endsWith(".test.js"))
  .map((f) => path.join("tests", f));

const result = spawnSync(
  process.execPath,
  ["--test", "--test-reporter=tap", ...testFiles],
  { cwd: ROOT, encoding: "utf8" }
);

const output = `${result.stdout || ""}${result.stderr || ""}`;

const totalMatch = output.match(/^1\.\.(\d+)/m);
const passMatch = output.match(/^# pass (\d+)/m);
const failMatch = output.match(/^# fail (\d+)/m);

const total = totalMatch ? Number(totalMatch[1]) : 0;
const pass = passMatch ? Number(passMatch[1]) : 0;
const fail = failMatch ? Number(failMatch[1]) : 0;

const report = { total, pass, fail, at: new Date().toISOString() };

const outPath = path.join(ROOT, "web", "data", "test-results.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(JSON.stringify(report));

process.exit(fail > 0 ? 1 : 0);
