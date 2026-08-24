// GET /api/health — reports model/key presence. Never decides a verdict.

export default function handler(req, res) {
  res.json({
    ok: true,
    model: process.env.GEMINI_MODEL || null,
    keyPresent: !!process.env.GEMINI_API_KEY,
    promptVersion: null,
    ledgerVersion: "1.0",
    mock: false,
  });
}
