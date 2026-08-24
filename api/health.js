// GET /api/health — reports model/key presence and the exact model that would answer, so the UI
// footer and the writeup can never disagree with what api/generate.js is actually configured to
// call. Never decides a verdict.

import { PROMPT_VERSION } from "./prompts.js";
import { getProviderOrder, listProviders } from "./providers/index.js";

export default function handler(req, res) {
  const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.6-flash,gemini-3.7-flash")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  res.json({
    ok: true,
    model: process.env.GEMINI_MODEL || null,
    keyPresent: !!process.env.GEMINI_API_KEY,
    promptVersion: PROMPT_VERSION,
    fallbackModels,
    providers: { configured: getProviderOrder(process.env), registered: listProviders() },
    ledgerVersion: "1.0",
    mock: process.env.MOCK_GENERATE === "1",
  });
}
