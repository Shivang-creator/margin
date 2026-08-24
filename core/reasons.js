// Data: reason code -> human strings. The engine evaluates; this file only names the outcome.

export const REASONS = {
  NO_QUOTE: {
    short: "no line in your notes cited",
    long: "Nothing was cited for this sentence, so there's no line in your notes to check it against.",
  },
  QUOTE_TOO_SHORT: {
    short: "no line in your notes cited",
    long: "The cited line was too short to count as a real citation.",
  },
  QUOTE_NOT_IN_NOTES: {
    short: "cited a line that isn't in your notes",
    long: "The cited text doesn't appear anywhere in your notes — it's a fabricated citation.",
  },
  NUMBER_NOT_IN_QUOTE: {
    short: "the number isn't in the cited line",
    long: "A number in this sentence doesn't appear in the line it cites.",
  },
  NO_CONTENT: {
    short: "says more than the cited line",
    long: "This sentence has no substantive content to check against the cited line.",
  },
  LOW_OVERLAP: {
    short: "says more than the cited line",
    long: "This sentence says more than the cited line actually supports.",
  },
  GROUNDED: {
    short: "grounded in your notes",
    long: "This sentence is supported by the cited line from your notes.",
  },
};

export function reasonFor(code) {
  return REASONS[code] ?? REASONS.NO_QUOTE;
}

// The explain-back variant: shown for a struck student sentence, naming the closest
// note line even though it didn't clear the bar.
export function explainBackClosest(quoteText) {
  return `Not in your notes — closest line: ${quoteText}`;
}
