// Provider registry, built from PROVIDER_ORDER (env). One `import` + one map entry per provider —
// T-14 adds featherless with exactly that: `import * as featherless from "./featherless.js";` plus
// one line in REGISTRY below. api/generate.js never imports a provider module directly.

import * as gemini from "./gemini.js";

const REGISTRY = {
  gemini,
};

// getProviderOrder(env) -> string[] — parses PROVIDER_ORDER (default "gemini"), trims, drops empties.
export function getProviderOrder(env = process.env) {
  const raw = env.PROVIDER_ORDER || "gemini";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// getProvider(name) -> the provider module ({ generate }) or undefined if unregistered.
export function getProvider(name) {
  return REGISTRY[name];
}

// listProviders() -> string[] of every provider name currently registered (health.js reports this).
export function listProviders() {
  return Object.keys(REGISTRY);
}
