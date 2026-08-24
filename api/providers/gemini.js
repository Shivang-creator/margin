// Gemini REST provider. Talks to generativelanguage.googleapis.com directly over fetch — no SDK,
// no dependency. Every call is timed out, every response is schema-gated (api/schema.js) before it
// is trusted, and the key never leaves this function (not returned, not logged, not in any thrown
// error message beyond what fetch itself might do — the URL is never logged by the caller).

import { buildRequest } from "../prompts.js";
import { parseGeneration } from "../schema.js";

const DEFAULT_TIMEOUT_MS = 20000;

// classifyRateLimit(payload) -> { code: "rate-limit-day"|"rate-limit-minute", retryAfterSec? }
// payload is a parsed Gemini error body: { error: { message, details: [...] } }.
// details[] carries a QuotaFailure (violations[].quotaId) and a RetryInfo (retryDelay: "34s").
export function classifyRateLimit(payload) {
  const details = Array.isArray(payload?.error?.details) ? payload.error.details : [];
  const quotaFailure = details.find((d) => typeof d?.["@type"] === "string" && d["@type"].includes("QuotaFailure"));
  const retryInfo = details.find((d) => typeof d?.["@type"] === "string" && d["@type"].includes("RetryInfo"));
  const quotaId = quotaFailure?.violations?.[0]?.quotaId ?? "";
  const message = payload?.error?.message ?? "";
  const isDay = /PerDay/i.test(quotaId) || /PerDay/i.test(message);

  let retryAfterSec;
  const retryDelay = retryInfo?.retryDelay;
  if (typeof retryDelay === "string") {
    const m = retryDelay.match(/([\d.]+)\s*s/);
    if (m) retryAfterSec = Math.ceil(parseFloat(m[1]));
  }

  return { code: isDay ? "rate-limit-day" : "rate-limit-minute", retryAfterSec };
}

// generate({action, notes, input, model, apiKey, fetchImpl, timeoutMs}) ->
//   { ok:true, data, model, latencyMs } | { ok:false, code, retryAfterSec?, detail?, latencyMs }
export async function generate({ action, notes, input, model, apiKey, fetchImpl, timeoutMs }) {
  const started = Date.now();
  const effectiveTimeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = fetchImpl ?? fetch;

  const { systemInstruction, contents, responseSchema } = buildRequest({ action, notes, input });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const requestBody = {
    systemInstruction,
    contents,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.2,
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);

  let res;
  try {
    res = await doFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err) {
    const latencyMs = Date.now() - started;
    if (err && err.name === "AbortError") {
      return { ok: false, code: "timeout", latencyMs };
    }
    return { ok: false, code: "upstream", detail: String(err && err.message ? err.message : err).slice(0, 200), latencyMs };
  } finally {
    clearTimeout(timer);
  }

  let payload;
  try {
    payload = await res.json();
  } catch {
    return { ok: false, code: "upstream", detail: "non-JSON response body", latencyMs: Date.now() - started };
  }

  if (!res.ok) {
    const latencyMs = Date.now() - started;
    if (res.status === 429) {
      const { code, retryAfterSec } = classifyRateLimit(payload);
      return { ok: false, code, retryAfterSec, latencyMs };
    }
    return { ok: false, code: "upstream", detail: JSON.stringify(payload).slice(0, 200), latencyMs };
  }

  const rawText = payload?.candidates?.[0]?.content?.parts?.map((p) => p?.text ?? "").join("") ?? "";
  const parsed = parseGeneration(action, rawText);
  const latencyMs = Date.now() - started;
  if (!parsed.ok) {
    return { ok: false, code: "bad-model-output", detail: parsed.detail, latencyMs };
  }

  return { ok: true, data: parsed.data, model, latencyMs };
}
