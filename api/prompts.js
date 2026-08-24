// Prompt contract for api/generate.js (PLAN §6), versioned so a cache key and a recorded response
// can both name the exact prompt they were produced under. Bump PROMPT_VERSION on any wording or
// schema change — it invalidates the client cache (web/cache.js keys on it) automatically.
//
// Findings from the current Gemini REST docs (checked 2026-08-25, ai.google.dev/api/generate-content
// + ai.google.dev/gemini-api/docs/generate-content/thinking), noted here per T-09 step 1:
//   - JSON mode: generationConfig.responseMimeType = "application/json" + generationConfig.responseSchema,
//     using UPPERCASE type names ("OBJECT", "ARRAY", "STRING", "INTEGER") — not JSON Schema's lowercase.
//   - Thinking budget: generationConfig.thinkingConfig.thinkingBudget; 0 disables thinking on models that
//     support full thinking-off. Some 3.x-flash variants do NOT support a true 0 (clamped to a minimum by
//     the API instead of erroring) — we still send 0 for latency; a non-zero clamp is a latency cost, not
//     a correctness bug, since the schema gate checks the output regardless of how it was produced.
//   - 429 errors carry error.details[] with a QuotaFailure (violations[].quotaId) and a RetryInfo
//     (retryDelay, e.g. "34s"). A quotaId/message containing "PerDay" is a daily quota; anything else at
//     429 is a per-minute quota. See api/providers/gemini.js classifyRateLimit for the parse.

export const PROMPT_VERSION = "1";

const SYSTEM_INSTRUCTION_TEXT = `You are writing for a student who will be examined on the NOTES below and \
nothing else. Use ONLY the notes. For every sentence you write, copy an exact, character-for-character \
excerpt of 5-30 words out of the notes into \`quote\` that supports the sentence. If no such excerpt \
exists, set \`quote\` to null and still write the sentence. One fact per sentence. No markdown.`;

const ASK_SCHEMA = {
  type: "OBJECT",
  properties: {
    sentences: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          quote: { type: "STRING", nullable: true },
        },
        required: ["text", "quote"],
      },
    },
  },
  required: ["sentences"],
};

const QUIZ_SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          answerIndex: { type: "INTEGER" },
          statement: { type: "STRING" },
          quote: { type: "STRING", nullable: true },
        },
        required: ["question", "options", "answerIndex", "statement", "quote"],
      },
    },
  },
  required: ["questions"],
};

function askUserText(notes, input) {
  return `NOTES:
${notes}

QUESTION: ${input}

Write 4-8 sentences answering the question using only the notes above. One fact per sentence. Return \
JSON matching {"sentences":[{"text": string, "quote": string|null}]}.`;
}

function quizUserText(notes) {
  return `NOTES:
${notes}

Write exactly 5 multiple-choice questions testing the notes above. For each item: \`question\` is the \
prompt; \`options\` is an array of exactly 4 strings; \`answerIndex\` is the 0-3 index of the correct \
option; \`statement\` is the correct answer written out as one declarative sentence (this is what gets \
fact-checked against your notes, so it must stand alone); \`quote\` is a 5-30 word verbatim excerpt out \
of the notes supporting \`statement\`, or null if none exists. Return JSON matching \
{"questions":[{"question": string, "options": string[4], "answerIndex": number, "statement": string, \
"quote": string|null}]}.`;
}

// buildRequest({action, notes, input}) -> { systemInstruction, contents, responseSchema }
// shaped exactly as the Gemini generateContent request body expects them.
export function buildRequest({ action, notes, input }) {
  if (action === "ask") {
    return {
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION_TEXT }] },
      contents: [{ role: "user", parts: [{ text: askUserText(notes ?? "", input ?? "") }] }],
      responseSchema: ASK_SCHEMA,
    };
  }
  if (action === "quiz") {
    return {
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION_TEXT }] },
      contents: [{ role: "user", parts: [{ text: quizUserText(notes ?? "") }] }],
      responseSchema: QUIZ_SCHEMA,
    };
  }
  throw new Error(`unknown action: ${action}`);
}
