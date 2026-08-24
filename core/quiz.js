import { ledger } from "./ledger.js";

// applyLedgerToQuiz(notesText, questions) runs the Ledger on each question's
// statement+quote pair. A question whose statement is INVENTED is marked
// refused: the quiz can't ask something the notes don't support. answerIndex is
// guarded to a valid option index or null.
export function applyLedgerToQuiz(notesText, questions) {
  const sentences = questions.map((q) => ({ text: q.statement, quote: q.quote ?? null }));
  const { verdicts, counts } = ledger(notesText, sentences);

  const graded = questions.map((q, i) => {
    const v = verdicts[i];
    const options = Array.isArray(q.options) ? q.options : [];
    const answerIndex =
      Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < options.length
        ? q.answerIndex
        : null;

    return {
      question: q.question,
      options,
      answerIndex,
      statement: q.statement,
      quote: q.quote ?? null,
      verdict: v.verdict,
      reason: v.reason,
      refused: v.verdict === "INVENTED",
    };
  });

  return { questions: graded, counts };
}
