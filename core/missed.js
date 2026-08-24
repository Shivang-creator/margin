import { splitSentences } from "./sentences.js";

function intersects(a, b) {
  return a.start < b.end && b.start < a.end;
}

// Note sentences with no GROUNDED verdict whose span overlaps them — coverage is
// judged by span, not by text equality, since a cited quote may be a sub-span of a
// longer note sentence.
export function missed(notesText, verdicts) {
  const noteSentences = splitSentences(notesText);
  const groundedSpans = verdicts
    .filter((v) => v.verdict === "GROUNDED" && v.span)
    .map((v) => v.span);

  return noteSentences.filter(
    (note) => !groundedSpans.some((span) => intersects(span, note))
  );
}
