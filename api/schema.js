// Response-shape gate: strips code fences the model sometimes wraps JSON in, parses, and
// validates against the exact ask/quiz contract (PLAN §6). Shared by every provider (T-14's
// featherless.js reuses parseGeneration) so "bad-model-output" means the same thing everywhere.

// Gemini/Featherless both occasionally answer with ```json ... ``` even when responseMimeType
// is application/json; strip a single leading/trailing fence of either ``` or ```json.
export function stripFences(text) {
  const trimmed = String(text ?? "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function isString(v) {
  return typeof v === "string";
}

function isStringOrNull(v) {
  return v === null || typeof v === "string";
}

export function validateAsk(data) {
  if (!data || typeof data !== "object") return { ok: false, detail: "not an object" };
  if (!Array.isArray(data.sentences)) return { ok: false, detail: "sentences is not an array" };
  if (data.sentences.length === 0) return { ok: false, detail: "sentences is empty" };
  for (const [i, s] of data.sentences.entries()) {
    if (!s || typeof s !== "object") return { ok: false, detail: `sentences[${i}] is not an object` };
    if (!("text" in s) || !isString(s.text)) return { ok: false, detail: `sentences[${i}].text missing or not a string` };
    if (!("quote" in s)) return { ok: false, detail: `sentences[${i}].quote is missing` };
    if (!isStringOrNull(s.quote)) return { ok: false, detail: `sentences[${i}].quote is not a string or null` };
  }
  return { ok: true };
}

export function validateQuiz(data) {
  if (!data || typeof data !== "object") return { ok: false, detail: "not an object" };
  if (!Array.isArray(data.questions)) return { ok: false, detail: "questions is not an array" };
  if (data.questions.length === 0) return { ok: false, detail: "questions is empty" };
  for (const [i, q] of data.questions.entries()) {
    if (!q || typeof q !== "object") return { ok: false, detail: `questions[${i}] is not an object` };
    if (!isString(q.question)) return { ok: false, detail: `questions[${i}].question missing or not a string` };
    if (!Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(isString)) {
      return { ok: false, detail: `questions[${i}].options must be exactly 4 strings` };
    }
    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) {
      return { ok: false, detail: `questions[${i}].answerIndex must be an integer 0-3` };
    }
    if (!isString(q.statement)) return { ok: false, detail: `questions[${i}].statement missing or not a string` };
    if (!("quote" in q) || !isStringOrNull(q.quote)) {
      return { ok: false, detail: `questions[${i}].quote missing or not a string/null` };
    }
  }
  return { ok: true };
}

const VALIDATORS = { ask: validateAsk, quiz: validateQuiz };

// parseGeneration(action, rawText) -> { ok:true, data } | { ok:false, detail }
// detail is capped to 200 chars (PLAN §6: bad-model-output's detail = first 200 chars).
export function parseGeneration(action, rawText) {
  const validator = VALIDATORS[action];
  if (!validator) return { ok: false, detail: `unknown action: ${action}` };

  const stripped = stripFences(rawText);
  let data;
  try {
    data = JSON.parse(stripped);
  } catch (err) {
    return { ok: false, detail: String(stripped).slice(0, 200) };
  }

  const result = validator(data);
  if (!result.ok) return { ok: false, detail: result.detail.slice(0, 200) };
  return { ok: true, data };
}
