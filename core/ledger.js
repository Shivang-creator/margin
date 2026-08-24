import { normalize, spanFor } from "./normalize.js";
import { tokenize, contentTokens, numberTokens } from "./tokens.js";
import { OVERLAP_THRESHOLD, MIN_QUOTE_TOKENS } from "./constants.js";

function contentOverlapRatio(sentenceText, quoteText) {
  const sentTokens = new Set(contentTokens(tokenize(normalize(sentenceText).norm)));
  const quoteTokens = new Set(contentTokens(tokenize(normalize(quoteText).norm)));
  if (sentTokens.size === 0) return 0;
  let hit = 0;
  for (const t of sentTokens) {
    if (quoteTokens.has(t)) hit++;
  }
  return hit / sentTokens.size;
}

// Verdict rules, evaluated in order — first failure wins (PLAN §4.3).
function verdictFor(sentenceText, quote, notesNorm, notesMap) {
  // Rule 1: no quote, or quote too thin to count as a real citation.
  const quoteNorm = quote ? normalize(quote).norm : "";
  const quoteContent = quote ? contentTokens(tokenize(quoteNorm)) : [];
  if (!quote || quoteContent.length < MIN_QUOTE_TOKENS) {
    return {
      verdict: "INVENTED",
      reason: !quote ? "NO_QUOTE" : "QUOTE_TOO_SHORT",
      span: null,
      overlap: 0,
    };
  }

  // Rule 2: the cited quote must actually appear in the notes.
  const idx = notesNorm.indexOf(quoteNorm);
  if (idx === -1) {
    return { verdict: "INVENTED", reason: "QUOTE_NOT_IN_NOTES", span: null, overlap: 0 };
  }
  const span = spanFor(notesMap, idx, quoteNorm.length);

  // Rule 3: every number in the sentence must appear in the cited quote.
  const sentenceNorm = normalize(sentenceText).norm;
  const sentenceNumbers = numberTokens(tokenize(sentenceNorm));
  const quoteNumbers = new Set(numberTokens(tokenize(quoteNorm)));
  const numberMismatch = sentenceNumbers.some((n) => !quoteNumbers.has(n));
  const overlap = contentOverlapRatio(sentenceText, quote);
  if (numberMismatch) {
    return { verdict: "INVENTED", reason: "NUMBER_NOT_IN_QUOTE", span, overlap };
  }

  // Rule 4: the sentence can't say substantially more than the cited quote supports.
  const sentenceContent = contentTokens(tokenize(sentenceNorm));
  if (sentenceContent.length === 0) {
    return { verdict: "INVENTED", reason: "NO_CONTENT", span, overlap: 0 };
  }
  if (overlap < OVERLAP_THRESHOLD) {
    return { verdict: "INVENTED", reason: "LOW_OVERLAP", span, overlap };
  }

  return { verdict: "GROUNDED", reason: "GROUNDED", span, overlap };
}

// ledger(notesText, sentences: [{text, quote}]) -> { verdicts[], counts }
export function ledger(notesText, sentences) {
  const { norm: notesNorm, map: notesMap } = normalize(notesText);

  const verdicts = sentences.map((s, i) => {
    const outcome = verdictFor(s.text, s.quote ?? null, notesNorm, notesMap);
    return {
      i,
      text: s.text,
      quote: s.quote ?? null,
      verdict: outcome.verdict,
      reason: outcome.reason,
      span: outcome.span,
      overlap: outcome.overlap,
    };
  });

  const counts = {
    written: verdicts.length,
    grounded: verdicts.filter((v) => v.verdict === "GROUNDED").length,
    struck: verdicts.filter((v) => v.verdict === "INVENTED").length,
  };

  return { verdicts, counts };
}
