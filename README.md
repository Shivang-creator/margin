# Margin

A study page with a red pen. You paste your notes, then explain them back, ask questions, and take a quiz;
every sentence, yours or the model's, is checked against the notes by code and either lights up the line it
came from or is struck out with the reason.

Live: **https://margin-shivcreates.vercel.app** · no login, click *Load sample* and type.

## The Ledger

The Ledger is a pure function: `ledger(notesText, sentences[]) → verdicts[]`. Each sentence arrives with a
verbatim quote from the notes (the model must attach one to every sentence it writes; for your own typed
sentences the code picks the closest note line). Four rules run in order and the first failure wins: no quote
or a quote under three content words (`NO_QUOTE`, `QUOTE_TOO_SHORT`); the quote isn't actually in the notes
(`QUOTE_NOT_IN_NOTES`); a number in the sentence isn't in the quote (`NUMBER_NOT_IN_QUOTE`); fewer than half
the sentence's content words appear in the quote (`LOW_OVERLAP`). Otherwise `GROUNDED`, with the character span
that gets highlighted.

Worked example, on the bundled sample notes, network off. Type this into Explain-back:

> Glycolysis happens in the cytoplasm and nets 2 ATP. Oxygen is the final electron acceptor. Peter Mitchell won
> the Nobel Prize in 1961. The citric acid cycle runs in the matrix.

Result: `4 sentences · 3 grounded · 1 struck`. The third sentence is struck, reason *the number isn't in the
cited line*, closest line "Peter Mitchell was awarded the Nobel Prize in Chemistry in 1978 for it." The other
three light up "Net gain from glycolysis: 2 ATP per glucose.", "Oxygen is the final electron acceptor and is
reduced to water." and "The citric acid cycle runs here." No model was involved; the same check then runs on
everything the model writes in Ask and Quiz.

## Prove it yourself

Node 20 or newer, nothing to install (`"dependencies": {}` is literal).

```
$ git clone https://github.com/Shivang-creator/margin && cd margin
$ npm test
ℹ tests 130
ℹ pass 130
ℹ fail 0
{"total":130,"pass":130,"fail":0,"at":"2026-08-24T20:39:44.793Z"}
```

The same generation, checked live and checked from cache with the model switched off, is byte-identical:

```
$ npm run killswitch
{"status":"model-off","sentences":[]}
on.source  = live
off.source = cached
sha256(on.json)  = 2e9e34ef298412d9e916dfaf9e27747e20cc3febcf441779cbfe6175ca170ae1
sha256(off.json) = 2e9e34ef298412d9e916dfaf9e27747e20cc3febcf441779cbfe6175ca170ae1
byte-identical: yes
```

The first line is the third arm: model off with an empty cache returns an honest empty state, never a
fabricated one. The ON arm goes through the real fetch path with an injected fetch that returns a recorded
Gemini response; the OFF arm is served from cache with a fetch that throws if called.

Thirty hand-labelled student sentences over the sample notes, with the pass margin written into the fixture
header before any case was run (`catchAtLeast: 12`, `falseStrikeAtMost: 5`, threshold 0.5):

```
$ npm run calibrate
caught 14/15  falseStrikes 1/15  (margin: catch>=12, falseStrike<=5, threshold 0.5)
```

| kind (5 each unless noted) | labelled | result |
|---|---|---|
| near-verbatim | GROUNDED | 5 grounded |
| light paraphrase | GROUNDED | 5 grounded |
| heavy paraphrase | GROUNDED | 4 grounded, **1 struck** (false strike) |
| plausible but absent | INVENTED | 5 struck |
| wrong number | INVENTED | 5 struck |
| off-topic (4) | INVENTED | 4 struck |
| semantic swap (1) | INVENTED | **0 struck** (false pass) |

The two misses, printed by the run and left as found: "Since red blood cells in mammals lack mitochondria
entirely, they rely solely on glycolysis for energy." is true and struck (`LOW_OVERLAP`, it combines two note
lines); "Cristae double the surface area of the inner membrane." is wrong and passes (the notes say
*increase*; no digit to catch). The threshold was not tuned after seeing the result. The same table, with the
false strike spotlighted, is in the footer of the live page under *How the Ledger is checked*.

## Run it locally

```
npm run dev                       # http://localhost:3000, real model calls, reads .env.local
MOCK_GENERATE=1 npm run dev       # replays fixtures/generations/*.json; chip says Fixture · localhost
node tools/ledger-cli.js notes.md generation.json   # verdict JSON on stdout
```

`.env.local` (never committed): `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.5-flash`,
`GEMINI_FALLBACK_MODELS=gemini-3.6-flash,gemini-3.7-flash`, `PROVIDER_ORDER=gemini,featherless`,
`FEATHERLESS_API_KEY`, `FEATHERLESS_MODEL=Qwen/Qwen2.5-14B-Instruct`. Explain-back works with no key at all.

## How it's put together

One rule: the Ledger decides and the model only writes. Three consequences. Every verdict carries a reason code
and a span, so the UI can light the exact line and the tally is counted, never typed. `core/` imports nothing
outside `core/`, and `tests/boundary.test.js` reads every core file as text and fails if `fetch`, `window`,
`document`, `localStorage`, `process` or `Math.random` appears; there is no RNG anywhere in core, so there is
nothing to seed. And the model layer is replaceable: adding the Featherless provider was one new file plus one
registry line, with `core/` untouched.

| Layer | Files | May import | Enforced by |
|---|---|---|---|
| Core (decides) | `core/*` | `./` within core | `test_core_imports_no_forbidden_tokens_or_paths_outside_core` |
| Orchestration (pure) | `web/pipeline.js` `model.js` `cache.js` `state.js` | core; fetch/storage/clock injected | `test_orchestration_files_are_dom_free` |
| Presentation | `web/ui/*`, `web/main.js` | web, core | `test_presentation_never_imports_api` |
| Model layer (writes) | `api/*` | `./` within api | `test_api_never_imports_web_or_core` |

The model never sees a verdict. The verdict never sees the model. Explain-back has no model path at all, on or
off (`test_explain_back_verdicts_are_identical_regardless_of_model_toggle`).

Stack: static HTML and ES modules, no build step, zero runtime dependencies; one Vercel serverless function
(`api/generate.js`) holds the key and validates the model's JSON against a hand-written schema before anything
reaches the browser. Gemini answers in JSON mode with a response schema; on a daily-quota 429 the function walks
`GEMINI_FALLBACK_MODELS`, then the next provider. The chip on every result names the model that actually
answered, read from the response, not from config.

## What is real, what is recorded, what is absent

**Real:** every verdict; the tally; live model calls; the browser cache; the model-off switch; the test count
(written by the test runner into `web/data/test-results.json`, which the footer reads); the calibration table.
**Recorded, not mocked:** `fixtures/generations/*.json` are real responses (three from `gemini-3.5-flash`, one
from `Qwen/Qwen2.5-14B-Instruct`, provider, model and timestamp in each), used by the dev server and tests only.
`grep -rn fixture api/` returns nothing; production has no replay path.
**Absent:** accounts, a database, other users, usage numbers, any benchmark beyond the 30-case table, PDF
input (paste or `.txt`/`.md` only), voice.

### What the Ledger cannot catch

It checks words and digits, not meaning. These all pass as GROUNDED against the sample notes, verified with
`tools/ledger-cli.js` and the calibration run:

- "Mitochondria do **NOT** carry their own small circular genome." against "Mitochondria carry their own small circular genome." (overlap 1.00; *not* is a stopword)
- "Protons are pumped **INTO** the matrix and flow **OUT** through ATP synthase." against "...pumped OUT of the matrix and flow back IN..." (direction swap)
- "Older textbooks say **ninety** ATP per glucose." against "...say 38 ATP per glucose" (a number in words; "90 ATP" is struck)
- "Cristae **halve** the surface area of the inner membrane." against "...which increase its surface area." (quantifier swap, no digit)

Also: heavy paraphrase across two note lines is struck though true (it leans toward doubt); a number typed
without its comma (`16569` for `16,569`) is struck; a one-word sentence such as "Mitochondria." can be grounded
by a heading; a quote that starts mid-word still matches. The obvious fix, a model judging meaning, would put
the model back in the loop that grades the model, which is the one thing this build refuses to do. Left as is,
said out loud.

## Sources and licence

`fixtures/sample-notes.md` is derived from the Wikipedia articles "Mitochondrion", "Cellular respiration" and
"Chemiosmosis" (retrieved 2026-08-25), paraphrased into first-year study notes, and is shared under
**CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/). The UI labels it *Sample*. The app sends
whatever notes you paste to the model provider; don't paste anything you can't share.

## AI tools used, by name

- **Claude Code (Anthropic)**, run as a crew of specialised agents from my plan and design decisions, wrote the
  code in `core/`, `web/`, `api/`, `tools/`, the tests, `docs/DESIGN.md`, the calibration set, and the first
  draft of this README and the Devpost writeup. The crew task IDs (T-03 ... T-21, R-xx, J-xx) in code comments
  and commit messages are that trail. I set the idea, the rules (model never decides, all code inside 17–29
  Aug, no dependencies), reviewed the output, recorded the video and edited the text.
- **Gemini 3.5 Flash** (Google) is the runtime model for Ask and Quiz, with 3.6 Flash and 3.7 Flash as
  daily-quota fallbacks.
- **Qwen2.5-14B-Instruct via Featherless** is the last-resort provider. Its 7B sibling was tried first and twice
  returned valid JSON of the wrong shape; the schema gate rejected it, which is the gate doing its job.

All code was written between 17 and 29 August 2026 for the Prometheus August AI Challenge and its two September
editions.
