// api/providers/gemini.js + api/providers/featherless.js + api/providers/index.js, with fetch
// injected — no network in tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generate } from "../api/providers/gemini.js";
import { generate as featherlessGenerate, DEFAULT_MODEL as FEATHERLESS_DEFAULT_MODEL } from "../api/providers/featherless.js";
import { getProviderOrder, getProvider, listProviders } from "../api/providers/index.js";

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

// --- Featherless (T-14): OpenAI-compatible chat completions, injected fetch, no network. ---

function featherlessOkFetch() {
  return async (url, opts) => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({ sentences: [{ text: "ATP is made in the mitochondria.", quote: null }] }),
          },
        },
      ],
    }),
  });
}

test("test_featherless_returns_ok_shape_via_injected_fetch", async () => {
  const result = await featherlessGenerate({
    action: "ask",
    notes: "x",
    input: "y",
    model: "Qwen/Qwen2.5-14B-Instruct",
    apiKey: "unused",
    fetchImpl: featherlessOkFetch(),
    timeoutMs: 1000,
  });
  assert.equal(result.ok, true);
  assert.equal(result.model, "Qwen/Qwen2.5-14B-Instruct");
  assert.ok(Array.isArray(result.data.sentences));
});

test("test_featherless_uses_default_model_when_none_given", async () => {
  const result = await featherlessGenerate({
    action: "ask",
    notes: "x",
    input: "y",
    model: undefined,
    apiKey: "unused",
    fetchImpl: featherlessOkFetch(),
    timeoutMs: 1000,
  });
  assert.equal(result.ok, true);
  assert.equal(result.model, FEATHERLESS_DEFAULT_MODEL);
});

test("test_featherless_sends_bearer_auth_and_user_agent_headers", async () => {
  let seenHeaders;
  const captureFetch = async (url, opts) => {
    seenHeaders = opts.headers;
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"sentences":[{"text":"a","quote":null}]}' } }] }) };
  };
  await featherlessGenerate({
    action: "ask",
    notes: "x",
    input: "y",
    model: "Qwen/Qwen2.5-14B-Instruct",
    apiKey: "the-secret-key",
    fetchImpl: captureFetch,
    timeoutMs: 1000,
  });
  assert.equal(seenHeaders.authorization, "Bearer the-secret-key");
  // Cloudflare returns error 1010 for requests with no User-Agent — this header must always be sent.
  assert.ok(seenHeaders["user-agent"] && seenHeaders["user-agent"].length > 0);
});

test("test_featherless_classifies_429_as_rate_limit_minute", async () => {
  const rateLimitedFetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ error: { message: "too many concurrent requests" } }),
  });
  const result = await featherlessGenerate({
    action: "ask",
    notes: "x",
    input: "y",
    model: "Qwen/Qwen2.5-14B-Instruct",
    apiKey: "unused",
    fetchImpl: rateLimitedFetch,
    timeoutMs: 1000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "rate-limit-minute");
});

test("test_featherless_non_json_content_is_bad_model_output", async () => {
  const garbageFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: "not json at all" } }] }),
  });
  const result = await featherlessGenerate({
    action: "ask",
    notes: "x",
    input: "y",
    model: "Qwen/Qwen2.5-14B-Instruct",
    apiKey: "unused",
    fetchImpl: garbageFetch,
    timeoutMs: 1000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "bad-model-output");
});

test("test_featherless_timeout_via_injected_fetch_that_never_resolves_before_timeoutMs", async () => {
  const neverResolvingFetch = (url, opts) =>
    new Promise((resolve, reject) => {
      opts.signal.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    });
  const result = await featherlessGenerate({
    action: "ask",
    notes: "x",
    input: "y",
    model: "Qwen/Qwen2.5-14B-Instruct",
    apiKey: "unused",
    fetchImpl: neverResolvingFetch,
    timeoutMs: 20,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "timeout");
});

test("test_featherless_generate_result_never_contains_the_api_key", async () => {
  const secretKey = "SECRET-DO-NOT-LEAK-ME";
  const badJsonFetch = async () => ({
    ok: false,
    status: 500,
    json: async () => {
      throw new Error("not json");
    },
  });
  const result = await featherlessGenerate({
    action: "ask",
    notes: "x",
    input: "y",
    model: "Qwen/Qwen2.5-14B-Instruct",
    apiKey: secretKey,
    fetchImpl: badJsonFetch,
    timeoutMs: 1000,
  });
  assert.equal(result.ok, false);
  assert.ok(!JSON.stringify(result).includes(secretKey));
});

test("test_featherless_enforces_single_inflight_request", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const trackingFetch = async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 15));
    inFlight -= 1;
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"sentences":[{"text":"a","quote":null}]}' } }] }) };
  };
  const call = () =>
    featherlessGenerate({
      action: "ask",
      notes: "x",
      input: "y",
      model: "Qwen/Qwen2.5-14B-Instruct",
      apiKey: "unused",
      fetchImpl: trackingFetch,
      timeoutMs: 1000,
    });
  const [a, b, c] = await Promise.all([call(), call(), call()]);
  assert.equal(maxInFlight, 1);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(c.ok, true);
});

test("test_registry_lists_both_gemini_and_featherless", () => {
  const providers = listProviders();
  assert.ok(providers.includes("gemini"));
  assert.ok(providers.includes("featherless"));
});

test("test_getProvider_returns_featherless_module_with_a_generate_function", () => {
  const provider = getProvider("featherless");
  assert.equal(typeof provider.generate, "function");
});
