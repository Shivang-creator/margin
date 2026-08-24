// getGeneration: model-off gate -> cache -> POST /api/generate; maps errors to honest
// states. The cache is checked before the model-off gate so a cache hit is byte-identical
// whether the model is on or off, and modelOff must return before fetchImpl is ever touched.

import { cacheKey } from "./cache.js";

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export async function getGeneration({ action, notes, input, state, fetchImpl, cache, now }) {
  const key = await cacheKey({
    notes,
    action,
    input,
    promptVersion: state?.promptVersion ?? null,
  });

  const cached = cache ? await cache.get(key) : null;
  if (cached) {
    return {
      source: "cached",
      generation: cached.data,
      meta: { ...cached, cachedAt: typeof now === "function" ? now() : undefined },
    };
  }

  if (state?.modelOff) {
    return { status: "model-off" };
  }

  if (!fetchImpl) {
    return { status: "no-key" };
  }

  if (isOffline()) {
    return { status: "offline" };
  }

  let res;
  try {
    res = await fetchImpl("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes, input }),
    });
  } catch (err) {
    // A rejected fetch with TypeError is the browser's own signal for "couldn't reach the
    // network at all" (DNS/connection failure) — DESIGN §5.4 calls that "offline", distinct
    // from a same-origin server error, which reaches here as a resolved (non-ok) Response.
    if (typeof TypeError !== "undefined" && err instanceof TypeError) {
      return { status: "offline" };
    }
    return { status: "upstream" };
  }

  let body;
  try {
    body = await res.json();
  } catch {
    return { status: "bad-model-output" };
  }

  if (!res.ok || !body.ok) {
    return { status: body.code ?? "upstream", retryAfterSec: body.retryAfterSec, detail: body.detail };
  }

  if (cache) await cache.set(key, body);

  return { source: "live", generation: body.data, meta: body };
}
