// R-02 regression: providers/gemini.js and providers/featherless.js used to put
// `err.message` straight into the `detail` field that api/generate.js forwards to the
// browser. Real undici error messages can echo the request (Gemini's key travels in the
// URL query string), so a network failure one error-message-shape away could leak the key
// to the client. Fixed: the catch(err) branches log server-side only and return a bare
// "upstream" code with no detail.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generate as gemGenerate } from "../api/providers/gemini.js";
import { generate as featherGenerate } from "../api/providers/featherless.js";

const SECRET = "SECRET_KEY_ABC123";

function throwingFetchWithKeyInMessage(url) {
  // Mirrors what a real fetch/undici failure can look like: the thrown error's message
  // includes the full request URL, key and all.
  return Promise.reject(new Error(`fetch failed: could not reach ${url}`));
}

test("test_provider_error_detail_never_contains_api_key gemini", async () => {
  const result = await gemGenerate({
    action: "ask",
    notes: "Mitochondria are the site of respiration.",
    input: "What do mitochondria do?",
    model: "gemini-3.5-flash",
    apiKey: SECRET,
    fetchImpl: throwingFetchWithKeyInMessage,
    timeoutMs: 1000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "upstream");
  const serialised = JSON.stringify(result);
  assert.ok(!serialised.includes(SECRET), `provider result must never carry the API key: ${serialised}`);
  assert.ok(!serialised.includes("key="), `provider result must never carry a key= query param: ${serialised}`);
});

test("test_provider_error_detail_never_contains_api_key featherless", async () => {
  const result = await featherGenerate({
    action: "ask",
    notes: "Mitochondria are the site of respiration.",
    input: "What do mitochondria do?",
    model: "Qwen/Qwen2.5-14B-Instruct",
    apiKey: SECRET,
    fetchImpl: () => Promise.reject(new Error(`fetch failed: Authorization: Bearer ${SECRET} rejected`)),
    timeoutMs: 1000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "upstream");
  const serialised = JSON.stringify(result);
  assert.ok(!serialised.includes(SECRET), `provider result must never carry the API key: ${serialised}`);
});
