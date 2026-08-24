// api/generate.js — the full provider chain (model ladder + provider handoff), with global fetch
// monkey-patched per test (the handler always calls the real `fetch`, never an injected one, so
// this is the only way to exercise it without network — restored in a `finally` after every test).
// Covers T-14's required cases: fallback ordering across GEMINI_FALLBACK_MODELS on a daily-quota
// 429, the minute-vs-day 429 distinction (a per-minute 429 must NOT walk the model ladder), and
// that the configured API keys never appear anywhere in a response body.

import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/generate.js";

const ORIGINAL_FETCH = globalThis.fetch;
const ENV_KEYS = [
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GEMINI_FALLBACK_MODELS",
  "FEATHERLESS_API_KEY",
  "FEATHERLESS_MODEL",
  "PROVIDER_ORDER",
];

function snapshotEnv() {
  return Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
}
function restoreEnv(snapshot) {
  for (const k of ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
  globalThis.fetch = ORIGINAL_FETCH;
}

function makeReq(body) {
  return { headers: {}, body };
}
function makeRes() {
  return {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function dayQuotaBody() {
  return {
    error: {
      message: "Quota exceeded for quota metric 'Generate Content API requests per day'.",
      details: [
        { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "PerDay" }] },
        { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "86400s" },
      ],
    },
  };
}
function minuteQuotaBody() {
  return {
    error: {
      message: "Quota exceeded for quota metric 'Generate Content API requests per minute'.",
      details: [
        { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "PerMinute" }] },
        { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "9s" },
      ],
    },
  };
}
function okAskBody() {
  return { candidates: [{ content: { parts: [{ text: '{"sentences":[{"text":"a","quote":null}]}' }] } }] };
}
function okFeatherlessBody() {
  return { choices: [{ message: { content: '{"sentences":[{"text":"a","quote":null}]}' } }] };
}

test("test_generate_handler_walks_gemini_fallback_ladder_in_order_on_daily_quota_429", async () => {
  const snapshot = snapshotEnv();
  try {
    process.env.GEMINI_API_KEY = "gk";
    process.env.GEMINI_MODEL = "gemini-3.5-flash";
    process.env.GEMINI_FALLBACK_MODELS = "gemini-3.6-flash,gemini-3.7-flash";
    process.env.PROVIDER_ORDER = "gemini";

    const modelsCalled = [];
    globalThis.fetch = async (url) => {
      const model = decodeURIComponent(String(url)).match(/models\/([^:]+):/)[1];
      modelsCalled.push(model);
      if (model === "gemini-3.7-flash") {
        return { ok: true, status: 200, json: async () => okAskBody() };
      }
      return { ok: false, status: 429, json: async () => dayQuotaBody() };
    };

    const res = makeRes();
    await handler(makeReq({ action: "ask", notes: "x", input: "y" }), res);

    assert.deepEqual(modelsCalled, ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash"]);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.model, "gemini-3.7-flash");
    assert.equal(res.body.provider, "gemini");
  } finally {
    restoreEnv(snapshot);
  }
});

test("test_generate_handler_does_not_walk_ladder_on_minute_quota_429_and_falls_to_next_provider", async () => {
  const snapshot = snapshotEnv();
  try {
    process.env.GEMINI_API_KEY = "gk";
    process.env.GEMINI_MODEL = "gemini-3.5-flash";
    process.env.GEMINI_FALLBACK_MODELS = "gemini-3.6-flash,gemini-3.7-flash";
    process.env.FEATHERLESS_API_KEY = "fk";
    process.env.FEATHERLESS_MODEL = "Qwen/Qwen2.5-7B-Instruct";
    process.env.PROVIDER_ORDER = "gemini,featherless";

    const geminiModelsCalled = [];
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes("generativelanguage.googleapis.com")) {
        const model = decodeURIComponent(u).match(/models\/([^:]+):/)[1];
        geminiModelsCalled.push(model);
        return { ok: false, status: 429, json: async () => minuteQuotaBody() };
      }
      if (u.includes("api.featherless.ai")) {
        return { ok: true, status: 200, json: async () => okFeatherlessBody() };
      }
      throw new Error(`unexpected fetch to ${u}`);
    };

    const res = makeRes();
    await handler(makeReq({ action: "ask", notes: "x", input: "y" }), res);

    // A per-minute 429 must not retry the fallback ladder — exactly one gemini model attempted.
    assert.deepEqual(geminiModelsCalled, ["gemini-3.5-flash"]);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.provider, "featherless");
  } finally {
    restoreEnv(snapshot);
  }
});

test("test_generate_handler_surfaces_rate_limit_minute_with_retryAfterSec_when_no_provider_succeeds", async () => {
  const snapshot = snapshotEnv();
  try {
    process.env.GEMINI_API_KEY = "gk";
    process.env.GEMINI_MODEL = "gemini-3.5-flash";
    process.env.GEMINI_FALLBACK_MODELS = "gemini-3.6-flash";
    process.env.PROVIDER_ORDER = "gemini";

    globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => minuteQuotaBody() });

    const res = makeRes();
    await handler(makeReq({ action: "ask", notes: "x", input: "y" }), res);

    assert.equal(res.statusCode, 429);
    assert.equal(res.body.code, "rate-limit-minute");
    assert.equal(res.body.retryAfterSec, 9);
  } finally {
    restoreEnv(snapshot);
  }
});

test("test_generate_handler_response_never_contains_any_configured_api_key", async () => {
  const snapshot = snapshotEnv();
  try {
    process.env.GEMINI_API_KEY = "GEMINI-SECRET-VALUE";
    process.env.GEMINI_MODEL = "gemini-3.5-flash";
    process.env.GEMINI_FALLBACK_MODELS = "gemini-3.6-flash";
    process.env.FEATHERLESS_API_KEY = "FEATHERLESS-SECRET-VALUE";
    process.env.FEATHERLESS_MODEL = "Qwen/Qwen2.5-7B-Instruct";
    process.env.PROVIDER_ORDER = "gemini,featherless";

    globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: { message: "boom" } }) });

    const res = makeRes();
    await handler(makeReq({ action: "ask", notes: "x", input: "y" }), res);

    const serialised = JSON.stringify(res.body);
    assert.ok(!serialised.includes("GEMINI-SECRET-VALUE"));
    assert.ok(!serialised.includes("FEATHERLESS-SECRET-VALUE"));
  } finally {
    restoreEnv(snapshot);
  }
});
