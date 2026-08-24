// Pure orchestration, DOM-free, deps injected (PLAN §3.3).

import { splitSentences } from "../core/sentences.js";
import { bestSpan } from "../core/align.js";
import { ledger } from "../core/ledger.js";
import { missed } from "../core/missed.js";
import { reduceTally } from "../core/tally.js";
import { applyLedgerToQuiz } from "../core/quiz.js";
import { getGeneration } from "./model.js";

const EMPTY_COUNTS = { written: 0, grounded: 0, struck: 0 };

// student text -> splitSentences -> bestSpan (align) -> ledger -> missed -> reduceTally.
// Zero network: no model path exists for explain-back, on or off.
export function runExplainBack({ notes, studentText, tally }) {
  const rawSentences = splitSentences(studentText ?? "");
  const withQuotes = rawSentences.map((s) => ({
    text: s.text,
    quote: bestSpan(notes ?? "", s.text).quote,
  }));

  const { verdicts, counts } = ledger(notes ?? "", withQuotes);
  const missedLines = missed(notes ?? "", verdicts);
  const nextTally = reduceTally(tally, counts, "explain-back");

  return { verdicts, counts, missedLines, tally: nextTally };
}

// question -> model.js (off? cache? live) -> ledger -> reduceTally.
export async function runAsk({ notes, question, state, fetchImpl, cache, now, tally }) {
  const result = await getGeneration({
    action: "ask",
    notes,
    input: question,
    state,
    fetchImpl,
    cache,
    now,
  });

  if (result.status) {
    return {
      status: result.status,
      retryAfterSec: result.retryAfterSec,
      verdicts: [],
      counts: EMPTY_COUNTS,
      tally,
    };
  }

  const sentences = result.generation?.sentences ?? [];
  const { verdicts, counts } = ledger(notes ?? "", sentences);
  const nextTally = reduceTally(tally, counts, "ask");

  return { source: result.source, meta: result.meta, verdicts, counts, tally: nextTally };
}

// notes -> model.js -> applyLedgerToQuiz (ledger on statement+quote) -> shown | refused.
export async function applyQuiz({ notes, state, fetchImpl, cache, now, tally }) {
  const result = await getGeneration({
    action: "quiz",
    notes,
    input: undefined,
    state,
    fetchImpl,
    cache,
    now,
  });

  if (result.status) {
    return {
      status: result.status,
      retryAfterSec: result.retryAfterSec,
      questions: [],
      counts: EMPTY_COUNTS,
      tally,
    };
  }

  const questions = result.generation?.questions ?? [];
  const { questions: graded, counts } = applyLedgerToQuiz(notes ?? "", questions);
  const nextTally = reduceTally(tally, counts, "quiz");

  return { source: result.source, meta: result.meta, questions: graded, counts, tally: nextTally };
}
