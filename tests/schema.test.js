// api/schema.js: the gate every provider's raw text must pass before api/generate.js trusts it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGeneration, validateAsk, validateQuiz } from "../api/schema.js";

test("test_parseGeneration_accepts_valid_ask_json_wrapped_in_code_fences", () => {
  const raw = '```json\n{"sentences":[{"text":"Mitochondria produce ATP.","quote":"the powerhouse of the cell"}]}\n```';
  const result = parseGeneration("ask", raw);
  assert.equal(result.ok, true);
  assert.equal(result.data.sentences.length, 1);
  assert.equal(result.data.sentences[0].quote, "the powerhouse of the cell");
});

test("test_parseGeneration_rejects_ask_sentence_missing_quote_key", () => {
  const raw = '{"sentences":[{"text":"Mitochondria produce ATP."}]}';
  const result = parseGeneration("ask", raw);
  assert.equal(result.ok, false);
  assert.match(result.detail, /quote/);
});

test("test_validateAsk_rejects_sentences_not_an_array", () => {
  const result = validateAsk({ sentences: "not an array" });
  assert.equal(result.ok, false);
});

test("test_parseGeneration_accepts_valid_quiz_json", () => {
  const raw = JSON.stringify({
    questions: [
      {
        question: "What is the powerhouse of the cell?",
        options: ["Nucleus", "Mitochondrion", "Ribosome", "Golgi apparatus"],
        answerIndex: 1,
        statement: "The mitochondrion is the powerhouse of the cell.",
        quote: "powerhouse of the cell",
      },
    ],
  });
  const result = parseGeneration("quiz", raw);
  assert.equal(result.ok, true);
  assert.equal(result.data.questions.length, 1);
});

test("test_validateQuiz_rejects_wrong_option_count", () => {
  const result = validateQuiz({
    questions: [
      {
        question: "q",
        options: ["a", "b", "c"],
        answerIndex: 0,
        statement: "s",
        quote: null,
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.match(result.detail, /options/);
});

test("test_validateQuiz_rejects_out_of_range_answerIndex", () => {
  const result = validateQuiz({
    questions: [
      {
        question: "q",
        options: ["a", "b", "c", "d"],
        answerIndex: 4,
        statement: "s",
        quote: null,
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.match(result.detail, /answerIndex/);
});
