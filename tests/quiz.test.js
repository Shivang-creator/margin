import { test } from "node:test";
import assert from "node:assert/strict";
import { applyLedgerToQuiz } from "../core/quiz.js";

const NOTES = "Mitochondria are the site of aerobic respiration. Cristae increase surface area.";

test("test_grounded_statement_is_not_refused", () => {
  const { questions } = applyLedgerToQuiz(NOTES, [
    {
      question: "What increases surface area?",
      options: ["Cristae", "Ribosomes", "Vacuoles", "Lysosomes"],
      answerIndex: 0,
      statement: "Cristae increase surface area.",
      quote: "Cristae increase surface area.",
    },
  ]);
  assert.equal(questions[0].refused, false);
  assert.equal(questions[0].verdict, "GROUNDED");
});

test("test_invented_statement_is_refused", () => {
  const { questions } = applyLedgerToQuiz(NOTES, [
    {
      question: "Where do mitochondria come from?",
      options: ["The mother", "The father", "Both parents", "Neither"],
      answerIndex: 0,
      statement: "Mitochondria are inherited from the mother.",
      quote: null,
    },
  ]);
  assert.equal(questions[0].refused, true);
  assert.equal(questions[0].verdict, "INVENTED");
});

test("test_out_of_range_answer_index_is_guarded_to_null", () => {
  const { questions } = applyLedgerToQuiz(NOTES, [
    {
      question: "What increases surface area?",
      options: ["Cristae", "Ribosomes"],
      answerIndex: 7,
      statement: "Cristae increase surface area.",
      quote: "Cristae increase surface area.",
    },
  ]);
  assert.equal(questions[0].answerIndex, null);
});

test("test_negative_answer_index_is_guarded_to_null", () => {
  const { questions } = applyLedgerToQuiz(NOTES, [
    {
      question: "What increases surface area?",
      options: ["Cristae", "Ribosomes"],
      answerIndex: -1,
      statement: "Cristae increase surface area.",
      quote: "Cristae increase surface area.",
    },
  ]);
  assert.equal(questions[0].answerIndex, null);
});

test("test_non_array_options_default_to_empty_array", () => {
  const { questions } = applyLedgerToQuiz(NOTES, [
    {
      question: "Broken question",
      options: undefined,
      answerIndex: 0,
      statement: "Cristae increase surface area.",
      quote: "Cristae increase surface area.",
    },
  ]);
  assert.deepEqual(questions[0].options, []);
  assert.equal(questions[0].answerIndex, null);
});

test("test_counts_aggregate_across_multiple_questions", () => {
  const { counts } = applyLedgerToQuiz(NOTES, [
    {
      question: "q1",
      options: ["a", "b"],
      answerIndex: 0,
      statement: "Cristae increase surface area.",
      quote: "Cristae increase surface area.",
    },
    {
      question: "q2",
      options: ["a", "b"],
      answerIndex: 0,
      statement: "Mitochondria are inherited from the mother.",
      quote: null,
    },
  ]);
  assert.deepEqual(counts, { written: 2, grounded: 1, struck: 1 });
});
