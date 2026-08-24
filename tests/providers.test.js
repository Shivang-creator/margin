// api/providers/gemini.js + api/providers/index.js, with fetch injected — no network in tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generate } from "../api/providers/gemini.js";
import { getProviderOrder } from "../api/providers/index.js";

function dayQuotaFetch() {
  return async () => ({
    ok: false,
    status: 429,
    json: async () => ({
      error: {
        message: "Quota exceeded for quota metric 'Generate Content API requests per day'.",
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.QuotaFailure",
            violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }],
          },
          { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "86400s" },
        ],
      },
    }),
  });
}

function minuteQuotaFetch() {
  return async () => ({
    ok: false,
    status: 429,
    json: async () => ({
      error: {
        message: "Quota exceeded for quota metric 'Generate Content API requests per minute'.",
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.QuotaFailure",
            violations: [{ quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" }],
          },
          { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "34s" },
        ],
      },
    }),
  });
}

test("test_classifies_day_quota_429_via_injected_fetch", async () => {
  const result = await generate({
    action: "ask",
    notes: "x",
    input: "y",
    model: "gemini-3.5-flash",
    apiKey: "unused",
    fetchImpl: dayQuotaFetch(),
    timeoutMs: 1000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "rate-limit-day");
});

test("test_classifies_minute_quota_429_via_injected_fetch", async () => {
  const result = await generate({
    action: "ask",
    notes: "x",
    input: "y",
    model: "gemini-3.5-flash",
    apiKey: "unused",
    fetchImpl: minuteQuotaFetch(),
    timeoutMs: 1000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "rate-limit-minute");
  assert.equal(result.retryAfterSec, 34);
});

test("test_timeout_via_injected_fetch_that_never_resolves_before_timeoutMs", async () => {
  const neverResolvingFetch = (url, opts) =>
    new Promise((resolve, reject) => {
      opts.signal.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    });

  const result = await generate({
    action: "ask",
    notes: "x",
    input: "y",
    model: "gemini-3.5-flash",
    apiKey: "unused",
    fetchImpl: neverResolvingFetch,
    timeoutMs: 20,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "timeout");
});

test("test_getProviderOrder_parses_csv_and_defaults_to_gemini", () => {
  assert.deepEqual(getProviderOrder({ PROVIDER_ORDER: "gemini,featherless" }), ["gemini", "featherless"]);
  assert.deepEqual(getProviderOrder({ PROVIDER_ORDER: " gemini , featherless " }), ["gemini", "featherless"]);
  assert.deepEqual(getProviderOrder({}), ["gemini"]);
});

test("test_generate_result_never_contains_the_api_key", async () => {
  const secretKey = "SECRET-DO-NOT-LEAK-ME";
  const badJsonFetch = async () => ({
    ok: false,
    status: 500,
    json: async () => {
      throw new Error("not json");
    },
  });

  const result = await generate({
    action: "ask",
    notes: "x",
    input: "y",
    model: "gemini-3.5-flash",
    apiKey: secretKey,
    fetchImpl: badJsonFetch,
    timeoutMs: 1000,
  });
  assert.equal(result.ok, false);
  assert.ok(!JSON.stringify(result).includes(secretKey));
});
