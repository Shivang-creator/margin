import { splitSentences } from "./sentences.js";
import { normalize } from "./normalize.js";
import { tokenize, contentTokens } from "./tokens.js";

function overlapRatio(sentenceText, candidateText) {
  const sentTokens = new Set(contentTokens(tokenize(normalize(sentenceText).norm)));
  const candTokens = new Set(contentTokens(tokenize(normalize(candidateText).norm)));
  if (sentTokens.size === 0) return 0;
  let hit = 0;
  for (const t of sentTokens) {
    if (candTokens.has(t)) hit++;
  }
  return hit / sentTokens.size;
}

// Finds the note sentence with the highest content overlap against `sentenceText`.
// Ties go to the earliest note sentence. Empty notes return a null quote.
export function bestSpan(notesText, sentenceText) {
  const noteSentences = splitSentences(notesText);
  let best = null;
  for (const note of noteSentences) {
    const overlap = overlapRatio(sentenceText, note.text);
    if (!best || overlap > best.overlap) {
      best = { quote: note.text, start: note.start, end: note.end, overlap };
    }
  }
  if (!best) {
    return { quote: null, start: null, end: null, overlap: 0 };
  }
  return best;
}
