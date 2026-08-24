// getGeneration: model-off gate -> cache -> POST /api/generate; maps errors to honest
// states. The cache is checked before the model-off gate so a cache hit is byte-identical
// whether the model is on or off, and modelOff must return before fetchImpl is ever touched.

import { cacheKey } from "./cache.js";

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

  let res;
  try {
    res = await fetchImpl("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes, input }),
    });
  } catch {
    return { status: "upstream" };
  }

  let body;
  try {
    body = await res.json();
  } catch {
    return { status: "bad-model-output" };
  }

  if (!res.ok || !body.ok) {
    return { status: body.code ?? "upstream", retryAfterSec: body.retryAfterSec };
  }

  if (cache) await cache.set(key, body);

  return { source: "live", generation: body.data, meta: body };
}
