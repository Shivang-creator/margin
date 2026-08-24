// Generation cache keyed by sha256-16(notesNorm|action|input|promptVersion) (PLAN §6).
// Storage is injected; falls back to an in-memory Map when none is given or writes fail.

import { normalize } from "../core/normalize.js";

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function cacheKey({ notes, action, input, promptVersion }) {
  const notesNorm = normalize(notes ?? "").norm;
  const raw = `${notesNorm}|${action ?? ""}|${input ?? ""}|${promptVersion ?? ""}`;
  const hash = await sha256Hex(raw);
  return `margin:gen:${hash.slice(0, 16)}`;
}

export function createCache(storage) {
  const memory = new Map();

  return {
    async get(key) {
      if (storage) {
        try {
          const raw = storage.getItem(key);
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      }
      return memory.has(key) ? memory.get(key) : null;
    },
    async set(key, value) {
      if (storage) {
        try {
          storage.setItem(key, JSON.stringify(value));
          return;
        } catch {
          // fall through to memory cache
        }
      }
      memory.set(key, value);
    },
  };
}
