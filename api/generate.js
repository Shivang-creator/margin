// POST /api/generate — the only network hop in Margin. Validates the request, walks the provider
// chain, falls back across GEMINI_FALLBACK_MODELS on a *daily* quota 429 only, and returns the
// exact envelope PLAN §6 promises (or an honest error code — never a spinner, never a retry loop).
//
// Logs only { provider, model, status, latencyMs } — never the key, never notes/input content.
// Production has no recorded-response replay path (that lives in tools/dev-server.js, dev-only).

import { PROMPT_VERSION } from "./prompts.js";
import { getProviderOrder, getProvider } from "./providers/index.js";

const MAX_NOTES_CHARS = 20000;
const MAX_INPUT_CHARS = 500;
const DEFAULT_MODEL = "gemini-3.5-flash";
const DEFAULT_FALLBACKS = "gemini-3.6-flash,gemini-3.7-flash";
const TIMEOUT_MS = 20000;

const STATUS_BY_CODE = {
  "rate-limit-minute": 429,
  "rate-limit-day": 429,
  "bad-model-output": 502,
  timeout: 504,
  upstream: 502,
};

function validateBody(body) {
  if (!body || typeof body !== "object") return "body must be a JSON object";
  if (body.action !== "ask" && body.action !== "quiz") return 'action must be "ask" or "quiz"';
  if (typeof body.notes !== "string" || body.notes.length === 0 || body.notes.length > MAX_NOTES_CHARS) {
    return `notes must be a non-empty string up to ${MAX_NOTES_CHARS} chars`;
  }
  if (body.action === "ask") {
    if (typeof body.input !== "string" || body.input.length === 0 || body.input.length > MAX_INPUT_CHARS) {
      return `input must be a non-empty string up to ${MAX_INPUT_CHARS} chars for action "ask"`;
    }
  }
  return null;
}

// sameOrigin(req) -> false only when an Origin header is present AND its host differs from the
// request's own Host header. No Origin at all (curl, server-to-server) is allowed through — PLAN
// §6 says "no auth (disclosed); size caps are the abuse limiter," this is a same-origin nicety.
function sameOrigin(req) {
  const origin = req.headers?.origin;
  if (!origin) return true;
  const host = req.headers?.host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function logAttempt({ provider, model, status, latencyMs }) {
  console.log(JSON.stringify({ provider, model, status, latencyMs }));
}

export default async function handler(req, res) {
  if (!sameOrigin(req)) {
    res.status(403).json({ ok: false, code: "forbidden", detail: "cross-origin request" });
    return;
  }

  const bodyError = validateBody(req.body);
  if (bodyError) {
    res.status(400).json({ ok: false, code: "bad-request", detail: bodyError });
    return;
  }
  const body = req.body;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ ok: false, code: "no-key" });
    return;
  }

  const providerOrder = getProviderOrder(process.env);
  const primaryModel = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS || DEFAULT_FALLBACKS)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let lastError = null;

  for (const providerName of providerOrder) {
    const provider = getProvider(providerName);
    if (!provider) continue;

    // Only Gemini has a daily-quota fallback ladder today; a provider with no ladder just gets
    // its one configured model (T-14 wires FEATHERLESS_MODEL the same way for featherless).
    const models =
      providerName === "gemini"
        ? [primaryModel, ...fallbackModels]
        : [process.env[`${providerName.toUpperCase()}_MODEL`]].filter(Boolean);
    const providerApiKey =
      providerName === "gemini" ? apiKey : process.env[`${providerName.toUpperCase()}_API_KEY`];

    for (const model of models) {
      if (!model || !providerApiKey) continue;

      const started = Date.now();
      const result = await provider.generate({
        action: body.action,
        notes: body.notes,
        input: body.input,
        model,
        apiKey: providerApiKey,
        fetchImpl: fetch,
        timeoutMs: TIMEOUT_MS,
      });
      const latencyMs = result.latencyMs ?? Date.now() - started;

      logAttempt({ provider: providerName, model, status: result.ok ? "ok" : result.code, latencyMs });

      if (result.ok) {
        res.status(200).json({
          ok: true,
          action: body.action,
          provider: providerName,
          model,
          promptVersion: PROMPT_VERSION,
          latencyMs,
          generatedAt: new Date().toISOString(),
          data: result.data,
        });
        return;
      }

      lastError = result;
      // Only a daily-quota 429 walks the fallback ladder; every other failure stops trying more
      // models for this provider (a per-minute limit or a bad response won't be fixed by a
      // different model name).
      if (result.code !== "rate-limit-day") break;
    }
  }

  const code = lastError?.code ?? "upstream";
  res.status(STATUS_BY_CODE[code] ?? 502).json({
    ok: false,
    code,
    retryAfterSec: lastError?.retryAfterSec,
    detail: lastError?.detail,
  });
}
