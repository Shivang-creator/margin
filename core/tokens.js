import { STOPWORDS } from "./stopwords.js";

export function tokenize(norm) {
  if (!norm) return [];
  return norm.split(" ").filter((t) => t.length > 0);
}

export function stem(t) {
  let w = t;

  if (w.endsWith("'s")) w = w.slice(0, -2);

  if (w.endsWith("ies")) {
    w = w.slice(0, -3) + "y";
  } else {
    if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
    else if (w.length > 5 && w.endsWith("ed")) w = w.slice(0, -2);
  }

  if (w.length > 3 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s")) w = w.slice(0, -1);

  return w;
}

export function contentTokens(tokens) {
  return tokens
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
    .map(stem);
}

const NUMBER_RE = /^\d+([.,]\d+)?$/;

export function numberTokens(tokens) {
  return tokens.filter((t) => NUMBER_RE.test(t));
}
