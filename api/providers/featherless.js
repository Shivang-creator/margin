// Featherless provider — OpenAI-compatible chat completions, second entry in the provider chain
// (registered in providers/index.js). Proves the abstraction api/generate.js already has: adding
// a provider costs one file + one registry line, zero changes to api/generate.js or core/.
//
// Verified live 2026-08-25 against https://api.featherless.ai/v1:
//   - POST /chat/completions, OpenAI shape: { model, messages:[{role,content}], response_format,
//     temperature, max_tokens }. `response_format: {type:"json_object"}` is honoured (confirmed by
//     a live call — the docs page for chat completions does not mention it, the model list page
//     does not document response_format either, so this was checked against the real endpoint, not
//     assumed from the docs).
//   - Cloudflare in front of the API returns error 1010 ("browser check") for requests with no
//     User-Agent header — every request here sends one.
//   - `FEATHERLESS_MODEL` default is `Qwen/Qwen2.5-14B-Instruct`, confirmed present in the
//     account's live `/v1/models` listing (21,783 models total — Featherless mirrors most of
//     Hugging Face, so an ID can look right and still not be hosted; this one is). NOT the smaller
//     7B sibling: a live recording attempt with `Qwen/Qwen2.5-7B-Instruct` reproducibly returned
//     syntactically-valid-but-wrong-shape JSON under `response_format:{type:"json_object"}` — the
//     `sentences` array degraded into a mix of objects and bare strings after the second item,
//     failing schema.js's `sentences[1].quote is missing` check every time (same input, twice).
//     `response_format:"json_object"` only guarantees parseable JSON, not our schema, and the 7B
//     model could not reliably hold the nested {text,quote} shape past one or two items; 14B held
//     it cleanly on the same prompt. Logged here rather than silently swapped, per doctrine: a
//     graceful fallback (picking a bigger model) must not hide that the cheaper model failed.
//   - The plan's concurrency limit is 4 units but Margin only ever needs one in-flight Featherless
//     call at a time; `withSingleFlight` below serialises calls made in the same process (the dev
//     server and tools/record-generation.js) so this module never issues two requests at once. This
//     is a same-process guarantee, not a distributed lock — Vercel would run separate serverless
//     invocations in separate processes; a second real concurrency layer is out of scope for v1
//     (noted honestly here rather than claimed away).

import { buildRequest } from "../prompts.js";
import { parseGeneration } from "../schema.js";

const DEFAULT_TIMEOUT_MS = 20000;
export const DEFAULT_MODEL = "Qwen/Qwen2.5-14B-Instruct";
const API_URL = "https://api.featherless.ai/v1/chat/completions";
const USER_AGENT = "margin/1.0 (+https://margin-notes.vercel.app)";

// withSingleFlight(fn) -> wraps fn so calls queue behind one another instead of running
// concurrently, even if the caller fires them without awaiting. Queue never rejects (a failed
// call must not jam the next one).
let queue = Promise.resolve();
function withSingleFlight(fn) {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function extractUserText({ action, notes, input }) {
  const { systemInstruction, contents } = buildRequest({ action, notes, input });
  return {
    systemText: systemInstruction?.parts?.[0]?.text ?? "",
    userText: contents?.[0]?.parts?.[0]?.text ?? "",
  };
}

async function doGenerate({ action, notes, input, model, apiKey, fetchImpl, timeoutMs }) {
  const started = Date.now();
  const effectiveTimeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = fetchImpl ?? fetch;
  const effectiveModel = model || DEFAULT_MODEL;

  const { systemText, userText } = extractUserText({ action, notes, input });

  const requestBody = {
    model: effectiveModel,
    messages: [
      { role: "system", content: systemText },
      { role: "user", content: userText },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 1024,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);

  let res;
  try {
    res = await doFetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        "user-agent": USER_AGENT,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err) {
    const latencyMs = Date.now() - started;
    if (err && err.name === "AbortError") {
      return { ok: false, code: "timeout", latencyMs };
    }
    // R-02: never forward err.message to the client (it's undici's own text and can carry
    // request internals). Log it server-side only; the client gets a code, nothing else.
    console.error(JSON.stringify({ provider: "featherless", event: "fetch-failed", message: String(err && err.message ? err.message : err).slice(0, 500) }));
    return { ok: false, code: "upstream", latencyMs };
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
    // Featherless has no Gemini-style daily-vs-per-minute quota split (it's a fixed-concurrency
    // subscription, not a per-day request cap); any 429 here means "too many in flight right now."
    if (res.status === 429) {
      return { ok: false, code: "rate-limit-minute", latencyMs };
    }
    const detail = payload?.error?.message ?? JSON.stringify(payload);
    return { ok: false, code: "upstream", detail: String(detail).slice(0, 200), latencyMs };
  }

  const rawText = payload?.choices?.[0]?.message?.content ?? "";
  const parsed = parseGeneration(action, rawText);
  const latencyMs = Date.now() - started;
  if (!parsed.ok) {
    return { ok: false, code: "bad-model-output", detail: parsed.detail, latencyMs };
  }

  return { ok: true, data: parsed.data, model: effectiveModel, latencyMs };
}

// generate({action, notes, input, model, apiKey, fetchImpl, timeoutMs}) -> same envelope as
// providers/gemini.js: { ok:true, data, model, latencyMs } | { ok:false, code, detail?, latencyMs }.
// Serialised process-wide via withSingleFlight — see header note.
export function generate(args) {
  return withSingleFlight(() => doGenerate(args));
}
