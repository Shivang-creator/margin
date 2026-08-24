# DESIGN — Margin

<!-- pc-designer, 25 Aug 2026. Inputs: DECISIONS.md, PLAN.md §0 §3.1 §4.3 §6 §8 §9 §14, ANALYSIS.md §6,
     BOARD T-12/T-13/T-22–T-25, design-craft.md. Implementer: pc-frontend (T-12, T-13). Vanilla HTML/CSS/JS,
     no build step, no webfonts, no icon library. Every string a screen shows is written here; copy it verbatim. -->

## 0. What this is, in the judge's first ten seconds

**Concept sentence (shown in the header, always):** *Every sentence cites your notes, or gets struck out.*

Margin is a study page a student keeps open for an hour. It is not a chat app and must not look like one: no
bubbles, no avatar, no gradient, no "AI" glyph. The metaphor is a ruled notebook page (the notes, left) and its
margin (the working surface, right) where a strict teacher has been through the text with a red pen. The red pen
is the Ledger, and it marks the student and the model with the same hand.

**Signature moment (the six seconds a judge screenshots):** a sentence on the right gets a line drawn through it,
left to right, with the reason beside it — while on the left the note line it should have come from lights up in
highlighter yellow, or nothing lights up, because nothing exists. This moment fires on the student's own typed
sentences first (Explain-back, zero network) and on the model's sentences second (Ask). Same animation, same chip,
same red. The thumbnail (§10) is this frame.

**Protagonist:** one student, alone, on a laptop the night before an exam; the judge is that student at N=1.
Desktop-first; fully usable at 390 px (§7). No login, no onboarding, no second user, no empty page: the sample
notes are one click away and the page explains itself in the header line.

**Substrate stance (rule 25):** the event is judged on four equal boxes and one of them is Pitch & Demo, so the
ceiling is "one polished screen that films well", not a visual showcase. Money goes into type, spacing, the strike
animation and the honest states. Nothing else is decorated.

## 1. Design tokens (`web/styles.css` — copy this block, then build on it)

Palette rule: every text/background pair below measures ≥ 4.5:1 (computed 25 Aug; values in the table). Meaning
is **never** carried by colour alone: every struck sentence has a strikethrough and a text chip, every grounded
sentence has a chip, every highlight has a text label in the notes gutter.

```css
:root {
  /* paper */
  --paper:        #F7F5F0;   /* page background */
  --surface:      #FFFFFF;   /* cards, inputs, notes pane */
  --line:         #D9D4CA;   /* hairlines, rules */
  --line-strong:  #B8B1A3;
  /* ink */
  --ink:          #1C1B19;   /* 15.8:1 on paper */
  --ink-2:        #57534B;   /* secondary text, 7.0:1 on paper */
  --ink-3:        #8A8479;   /* placeholders, decorative only — never for meaning */
  /* verdicts */
  --struck:       #A8271B;   /* the red pen; 6.5:1 on paper */
  --struck-bg:    #FBE9E6;
  --grounded:     #1F6B3A;   /* 6.0:1 on paper */
  --grounded-bg:  #E4F3E8;
  --mark:         #FFE985;   /* highlighter on the notes span; ink on mark 14.1:1 */
  --mark-closest: transparent; /* "closest line" uses a dashed underline in --struck, no fill */
  /* provenance */
  --gen:          #2A56A3;   /* Generated / Cached chips; 6.5:1 on paper */
  --warn:         #6E4300;   /* degraded/honest states text; 7.6:1 on --warn-bg */
  --warn-bg:      #FFF1D2;
  --focus:        #2A56A3;   /* 2px solid outline + 2px offset, everywhere */
  /* type — system only, no webfonts (rule: judge's clean browser, first paint < 1 s) */
  --font-ui:    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-notes: Charter, "Iowan Old Style", "Palatino Linotype", Georgia, "Times New Roman", serif;
  --font-mono:  ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --fs-12: 0.75rem;  --fs-13: 0.8125rem;  --fs-14: 0.875rem;  --fs-16: 1rem;
  --fs-17: 1.0625rem; --fs-20: 1.25rem;   --fs-24: 1.5rem;    --fs-28: 1.75rem;
  --lh-tight: 1.25;  --lh-body: 1.5;  --lh-notes: 1.65;
  /* spacing, 4-px base */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-6: 24px; --s-8: 32px; --s-12: 48px;
  --radius: 6px; --radius-chip: 999px;
  --header-h: 56px; --tally-h: 44px; --tap: 44px;
  --strike-ms: 220ms; --stagger-ms: 60ms; --fade-ms: 200ms;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #1B1A17; --surface: #26241F; --line: #3A372F; --line-strong: #57534B;
    --ink: #ECE8DF; --ink-2: #B5AFA3; --ink-3: #7E7869;
    --struck: #F28B7D; --struck-bg: #4A211C; --grounded: #7FD39A; --grounded-bg: #1E3A28;
    --mark: #5C4E0E; --gen: #9DBCF5; --warn: #FFD48A; --warn-bg: #3F2E0C; --focus: #9DBCF5;
  }
}
@media (prefers-reduced-motion: reduce) {
  :root { --strike-ms: 0ms; --stagger-ms: 0ms; --fade-ms: 0ms; }
  * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
```

**Dark-mode stance:** follows the OS, no in-app toggle (one less control in the header; the video is recorded in
light mode, the paper look). Every pair was re-measured for dark: ink/paper 14.2, struck/paper 7.3, grounded/paper
9.7, ink/mark 6.7, gen/surface 8.1, warn/warn-bg 9.4, struck/struck-bg 5.8 — all ≥ 4.5:1.

**Contrast table (light):** ink/paper 15.8 · ink-2/paper 7.0 · struck/paper 6.5 · struck/struck-bg 6.0 ·
grounded/paper 6.0 · grounded/grounded-bg 5.7 · ink/mark 14.1 · gen/paper 6.5 · warn/warn-bg 7.6 · focus/paper 6.5.

**Type scale in use:** header brand `--fs-20` 600 · concept sentence `--fs-14` `--ink-2` · surface tab labels
`--fs-14` 500 · body/inputs `--fs-16` · notes pane `--font-notes` `--fs-17` `--lh-notes` · sentence rows
`--fs-16` `--lh-body` · chips `--fs-12` 600 uppercase letter-spacing 0.04em · tally numbers `--fs-24` 600
tabular-nums (`font-variant-numeric: tabular-nums` so the tick does not jitter) · footer `--fs-13`.
All sizes in rem; the page is tested at browser zoom 200 % and at a 20 px root without horizontal scroll.

## 2. Layout — one screen, three surfaces (desktop ≥ 900 px)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Margin   Every sentence cites your notes, or gets struck out.        [Model  ● on  ]    │ header 56px, sticky
├──────────────────────────────────┬──────────────────────────────────────────────────────┤
│ NOTES  [Notes] [Sample]          │ LEDGER   12 sentences · 9 grounded · 3 struck        │ tally strip 44px,
│ 3,412 chars · Paste · .txt/.md · │          [Rule · Ledger v1.0]   Reveal struck ( ) ◯  │ sticky in right col
│ Load sample · Clear              ├──────────────────────────────────────────────────────┤
│──────────────────────────────────│ [ Explain-back ] [ Ask ] [ Quiz ]                    │ tabs, 44px
│ § Mitochondria                   ├──────────────────────────────────────────────────────┤
│ Mitochondria are the site of     │ Close your notes. Type what you remember.            │
│ aerobic respiration. ←╌╌╌╌╌╌╌╌╌╌╌│ ┌──────────────────────────────────────────────────┐ │
│   closest line                   │ │ Mitochondria make ATP by aerobic respiration.    │ │
│ ▌The inner membrane is folded    │ │ Cristae make more surface area. Mitochondria are │ │
│ ▌into cristae, which increase    │ │ found only in animal cells.                      │ │
│ ▌surface area.▐  ← lit (--mark)  │ └──────────────────────────────────────────────────┘ │
│ ATP synthase uses the proton     │                              [ Check my explanation ] │
│ gradient to make ATP. Most of    │──────────────────────────────────────────────────────│
│ the cell's ATP — about 90% — is  │ 3 sentences · 2 grounded · 1 struck   [Rule · Ledger] │ per-run line
│ made here.                       │ ✓ Mitochondria make ATP by aerobic respiration.      │
│                                  │   GROUNDED · line 1                                  │
│                                  │ ✓ Cristae make more surface area.                    │
│                                  │   GROUNDED · line 2                                  │
│                                  │ ~~Mitochondria are found only in animal cells.~~     │ ← the strike
│                                  │   NOT IN YOUR NOTES · says more than the closest line│
│                                  │   closest line: "Mitochondria are the site of…"      │
│                                  │ What you missed (2 lines never mentioned)            │
│                                  │   · ATP synthase uses the proton gradient to make ATP│
│                                  │   · Most of the cell's ATP — about 90% — is made here│
├──────────────────────────────────┴──────────────────────────────────────────────────────┤
│ Model gemini-3.5-flash (from /api/health) · Ledger v1.0 · 91/91 tests · 27 Aug         │ footer
│ Tags: [Notes] [Rule] [Generated] [Cached] [Sample]   How the Ledger is checked ▾        │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

- Grid: `grid-template-columns: minmax(360px, 44%) 1fr`, gap 0, a 1 px `--line` divider. Page max-width 1440 px,
  centred; below 1100 px the notes column is `minmax(320px, 42%)`.
- Both columns scroll independently (`overflow-y: auto; height: calc(100vh - var(--header-h) - footer)`); the notes
  pane scroll position is what the signature moment drives.
- Header is `position: sticky; top: 0`, `--surface`, bottom hairline. Contents: brand (plain text "Margin",
  `--fs-20` 600, no logo) · concept sentence (`--ink-2`, hidden below 600 px) · model toggle (§5.1).
- Tally strip is sticky at the top of the right column; the tabs sit under it and scroll with content.
- Footer is not sticky; it is the last thing in the document, full width, `--paper`, top hairline.
- Notes pane header (the strip with the chips and actions) is sticky inside the notes column.

### 2.1 Notes pane (left) — the source of truth, tagged **Notes**
- Rendered from `state.notes` as one `<article class="notes">` in `--font-notes`. Markdown headings (`#`) render as
  bold `--fs-20` lines; bullets keep their `-`; nothing else is parsed. Line breaks preserved (`white-space:
  pre-wrap`). Text is never altered — the pane shows the exact string the Ledger read.
- Editing: the pane header has a **Paste** button that focuses a `<textarea>` overlay (same box, same font) and a
  **Done** button; `.txt/.md` via `<input type=file accept=".txt,.md">` styled as a button; **Load sample**;
  **Clear** (confirm inline: "Clear notes? [Clear] [Keep]", no `window.confirm`). Char counter `3,412 / 20,000`.
- Highlighting: on a verdict set, the pane is re-rendered **once** with `<mark class="span">` around every
  GROUNDED span and `<span class="closest">` around every struck student sentence's closest line. Never per-char
  spans; never a second DOM pass per sentence. Each `<mark>` carries `data-sentence="i"`.
- Gutter labels: a `<mark>` shows a 1 px `--grounded` left rule and, on hover/focus of its sentence, a small
  `--fs-12` label "cited by sentence 2" floated in the left gutter (gutter width 0 on mobile; label goes inline
  above the mark).
- The "closest line" for a struck student sentence: dashed underline `2px dashed var(--struck)`, gutter label
  "closest line". No fill — a struck sentence never lights anything yellow.

### 2.2 Working surface (right) — Explain-back · Ask · Quiz
Tabs are `<button role="tab">` in a `role="tablist"`, 44 px tall, underline indicator 2 px `--ink`. Active tab is
persisted. Every surface has the same skeleton: **prompt line** (one sentence, `--ink-2`), **input**, **action
button**, **result region** (`aria-live="polite"`), and the **per-run line**.

### 2.3 Sentence row (the unit everything is built from)
```
 [verdict mark]  sentence text                                   [chip: GROUNDED · line 2]
                 sub-line (reason long-form, --ink-2, --fs-14)
```
- `<li class="sentence verdict-grounded|verdict-invented" data-i>`; the text is a `<button class="sentence-text">`
  (44 px min height, full-width, left-aligned, no border) so it is keyboard-focusable; hover/focus/click →
  §4 "scroll-to-span".
- GROUNDED: leading 12 px `--grounded` square (not a tick glyph — no emoji, no ambiguous icons), text in `--ink`,
  chip `GROUNDED · line N` (`--grounded` on `--grounded-bg`, solid border). Visually-hidden prefix "Grounded:".
- INVENTED: leading 12 px `--struck` square, text wrapped in `<s>` with the animated line (§3), chip
  `NOT IN YOUR NOTES` (`--struck` on `--struck-bg`, solid border) followed by the reason short string from
  `core/reasons.js` in `--ink-2`. Visually-hidden prefix "Struck:". Under it, for student sentences only:
  `closest line: "…first 60 chars…"`.
- Reason strings (from PLAN §4.3, shown verbatim as the sub-line):
  `NO_QUOTE`/`QUOTE_TOO_SHORT` → "no line in your notes cited" · `QUOTE_NOT_IN_NOTES` → "cited a line that isn't
  in your notes" · `NUMBER_NOT_IN_QUOTE` → "the number isn't in the cited line" · `LOW_OVERLAP` → "says more than
  the cited line" · `NO_CONTENT` → "nothing to check in this sentence". For student sentences `LOW_OVERLAP` reads
  "says more than the closest line".
- Chip anatomy: `--fs-12` 600 uppercase, padding 2px 8px, radius `--radius-chip`, 1 px border. Verdict chips are
  solid-bordered; provenance chips (§6) are dashed-bordered — border style, not colour, separates the two families.

## 3. The signature moment — spec, timing, fallback

1. Content is complete before render. `pipeline.run*` returns the full verdict list; the UI mounts every row in
   one `innerHTML`/fragment write. **No timers, no per-sentence delays** (`grep setTimeout web/` must be 0 outside
   the rate-limit countdown).
2. Each `<s>` gets the line drawn on mount: `.verdict-invented s { text-decoration: none; position: relative }`,
   `.verdict-invented s::after { content:""; position:absolute; left:0; right:0; top:55%; height:2px;
   background:var(--struck); transform-origin:left; transform:scaleX(0); animation: strike var(--strike-ms)
   ease-out forwards; animation-delay: calc(var(--i) * var(--stagger-ms)) }` with `--i` set inline per row.
   `@keyframes strike { to { transform: scaleX(1) } }`. Transform only — compositor-cheap, no layout thrash.
   Under reduced-motion the variables are 0 ms and the line is simply there (§1).
3. Simultaneously the notes pane `<mark>` elements fade `background-color` from transparent to `--mark` over
   `--fade-ms`; the pane scrolls (`scroll-behavior: smooth`, auto under reduced-motion) to the **first struck**
   student sentence's closest line if any, else to the first grounded span. Scroll target sits at 30 % of pane
   height (`scroll-margin-top: 30vh` on marks) so the lit line is never under the sticky pane header.
4. The tally strip numbers update in the same frame (no counting animation; the video "tick" is the real
   re-render between runs). The per-run line reads `N sentences · M grounded · K struck` where the words are
   `--ink-2` and the numbers `--ink` 600.
5. Multi-line wrap: `s::after` on a wrapped sentence only covers the first line box. Fix in CSS, not JS:
   `.verdict-invented s { text-decoration: line-through; text-decoration-color: var(--struck);
   text-decoration-thickness: 2px }` is the resting state applied by `animation-fill-mode` end — i.e. the
   `::after` line draws, then at animation end a class-free rule takes over: implement as
   `.verdict-invented s { text-decoration-line: line-through; text-decoration-color: transparent;
   transition: text-decoration-color 0ms var(--strike-ms) }` and `.mounted .verdict-invented s
   { text-decoration-color: var(--struck) }` with `.mounted` added on the next frame via
   `requestAnimationFrame` (one rAF, not a timer). The `::after` line covers the first line during the draw;
   the real `line-through` covers every line after. Reduced-motion: both apply at once.
6. Reveal toggle on: `.reveal .verdict-invented s { text-decoration-color: transparent } .reveal
   .verdict-invented s::after { display:none }` and the row keeps its chip and its `--struck` square, gains a
   3 px `--struck` left border on the whole row. Text is `--ink`. Reason sub-line unchanged. The reveal toggle
   never re-runs anything; it is a class on the results container.

**Absence made visible (the "shows nothing, because nothing exists" half):** when a struck **model** sentence is
hovered/focused/clicked, the notes pane does not scroll and nothing lights; instead the notes pane header shows a
one-line strip for as long as the sentence is hovered/focused (persisting after click until another sentence is
picked): `NO_QUOTE` → "Nothing cited for this sentence — nothing to look for." · `QUOTE_NOT_IN_NOTES` → `Searched
your notes for “<first 50 chars of quote>” — not found.` · `NUMBER_NOT_IN_QUOTE` / `LOW_OVERLAP` → the cited line
IS in the notes, so it scrolls and gets the dashed `.closest` treatment with gutter label "cited line", and the
strip reads "Cited line found. The sentence says more than it." / "Cited line found. The number isn't in it."

## 4. Interaction notes
- **scroll-to-span** (hover 150 ms intent delay via CSS `:hover` only — no JS hover timers; click/focus is
  immediate): adds `.active` to the matching `<mark>` (2 px `--grounded` outline) and scrolls it to 30 % height.
  Keyboard: Tab through sentence buttons; Enter/Space = click; Escape clears `.active`.
- **Check / Ask / Make quiz buttons:** 44 px tall, `--ink` background, `--surface` text (17.2:1), radius
  `--radius`, disabled = `--line-strong` bg + `--ink-2` text + `cursor: not-allowed` + the disabled reason shown as
  text beside the button (never a tooltip-only reason). Enter in the Ask input submits; Cmd/Ctrl+Enter submits the
  Explain-back textarea (hint text under the textarea says so).
- **Slow network:** Ask/Quiz show the elapsed counter (§5.4) driven by the request's own promise plus one
  `requestAnimationFrame` loop that stops on settle; the server aborts at 20 s (PLAN §6) and the UI renders
  `timeout`. There is no client-side second timeout.
- **Errors never replace the previous result.** The state card (§5) renders *above* the last result region, which
  stays visible and greyed 60 % opacity with a "previous answer" label — the student never loses work.
- **Persistence** (`web/state.js`): notes, sessions, tally, modelOff, active tab, reveal (off on load). A
  returning student sees their notes and tally exactly as left; there is no "welcome back" screen.
- **Focus order:** header (brand is not focusable) → model toggle → notes actions → notes text (only when editing)
  → tally reveal toggle → tabs → surface input → action button → result rows → footer links. `:focus-visible`
  outline `2px solid var(--focus); outline-offset: 2px` on everything; never `outline: none` without replacement.
- **Live regions:** per-run line and state cards are `aria-live="polite"`; the tally strip is `aria-live="polite"
  aria-atomic="true"`.

## 5. States — every surface, every code (no state is improvised)

State cards share one component `<div class="state state-<code>" role="status">` with: a 4 px left border
(`--warn` for degraded, `--struck` for failures, `--gen` for informational), a **title** (`--fs-16` 600), a **body**
(`--fs-14`), an optional **action** (link-style button), and the provenance chip that applies. Never a spinner
icon anywhere in the app.

### 5.1 Model toggle (header) — `<button role="switch" aria-checked>`
Label text "Model" + track 40×22 + state word **on** / **off** (the word is part of the control, not colour).
Off → the whole working surface gets a top banner (state `model-off`, `--warn-bg`):
**Title:** "Model off." **Body:** "Ask and Quiz will only show what's already cached in this browser. Explain-back
keeps working — the Ledger is code, not a prompt." Banner stays until toggled back; Ask/Quiz buttons stay enabled
(they may hit cache).

### 5.2 Notes pane states
| State | When | Screen |
|---|---|---|
| empty | `notes.length === 0` | Pane body is a dashed-border drop zone, 240 px min: "Paste your notes here, drop a .txt or .md, or **Load sample**." Load sample is a real button inside the zone. Working surface inputs are disabled with beside-text "Add notes first." |
| too short | fewer than 3 sentences from `splitSentences` **or** < 120 chars | Pane header strip (`--warn-bg`): "Notes too short to check — the Ledger needs at least 3 sentences (you have N)." Surfaces disabled with "Notes too short." |
| over limit | `> MAX_NOTES_CHARS` (20,000) | Counter turns `--struck` and reads "24,118 / 20,000"; strip: "Too long by 4,118 characters. The Ledger reads at most 20,000." Action **Trim to 20,000** (cuts at the last sentence end before the limit). Surfaces disabled with "Notes over the limit." Nothing is silently truncated. |
| sample | notes came from Load sample | **Sample** chip beside **Notes** chip; strip under the header (`--paper`, not warn): "Sample notes: <title from the fixture's first heading> · source and licence in the file. Paste your own to replace." Dismissable for the session. The chip stays. |
| editing | Paste pressed | Textarea overlay, same font/metrics; **Done** commits; existing highlights are cleared (verdicts belong to the old text — say so in the per-run line: "Notes changed since this check."). |
| PDF (T-23 only) | file is .pdf | If T-23 lands: "Extracted N characters — check it." strip, and `no text layer` state: "This PDF has no text layer. Paste the text instead." If T-23 is cut, `.pdf` is not in `accept` and the copy everywhere says "paste or .txt/.md". |

### 5.3 Explain-back surface
Prompt line: "Close your notes. Type what you remember — every sentence gets checked against the page." Textarea
6 rows, placeholder "Two or three sentences from memory…". Button **Check my explanation**. Hint: "⌘/Ctrl+Enter".
| State | Screen |
|---|---|
| empty (no run yet) | Prompt + textarea + button; below, in `--ink-2`: "Nothing checked yet. This never uses the model — it's code against your notes, and works offline." |
| no sentences | Button disabled with beside-text "Write at least one sentence." |
| result | Per-run line + sentence rows (§2.3) + **What you missed** list: heading "What you missed (N lines never mentioned)", each item is the note sentence text as a button that scrolls the pane to it; 0 missed → "You covered every line." |
| notes changed | Rows greyed 60 %, per-run line prefixed "Notes changed since this check ·". |
| loading | **Does not exist.** The run is synchronous; if a spinner is ever needed here something is wrong. |
| model feedback (T-24 only) | One line under the rows, chip **Generated · <model>**, text in `--ink-2`; when model off or any error: the line is simply absent (no state card). |

### 5.4 Ask surface
Prompt line: "Ask anything about the page. Every sentence in the answer has to cite a line, and code checks it."
Input single-line, 500-char max with counter appearing at 400. Button **Ask**.
| Code / state | Card border | Title | Body | Action |
|---|---|---|---|---|
| empty | — | — | "No questions yet." (`--ink-2`) | — |
| loading | `--gen` | "Asking gemini-3.5-flash · 4 s" (model name from `/api/health`; the seconds tick every second via rAF, tabular-nums) | "Answers take 2–10 s. The server gives up at 20 s and says so." | Button reads **Asking…**, disabled; input stays editable |
| result | — | per-run line `9 sentences · 7 grounded · 2 struck` + chip **Generated · gemini-3.5-flash** (model from the response, not health) + `latencyMs` as "3.2 s" in `--ink-2` | sentence rows | "Ask again live" is absent on a live result |
| cached | `--gen` (thin, inline with the per-run line, not a card) | chip **Cached · 14:32** | rows as above; sub-text "Stored in this browser when you asked before. Nothing was sent." | **Ask again live** (hidden when model off) |
| model-off (no cache hit) | `--warn` | "Model off — nothing cached for this question." | "Turn the model on to ask this, or ask a question you've asked before. Explain-back doesn't need the model." | **Turn model on** (flips the header switch) |
| rate-limit-minute | `--warn` | "Rate limited — try again in 23 s" (counts down from `retryAfterSec`; the only `setTimeout` in `web/`, in a function named `countdown`) | "The free tier allows a few requests a minute. The Ledger has nothing to check until a new answer arrives." At 0 the title becomes "You can ask again." and the button re-enables. | — |
| rate-limit-day | `--struck` | "Daily quota exhausted on every model." | "Tried gemini-3.5-flash, gemini-3.6-flash, gemini-3.7-flash (names from the response). Quota resets around 12:30 IST. Cached answers still open; Explain-back still works." | **Show cached answers** (filters the session list) |
| bad-model-output | `--struck` | "The model's answer didn't follow the contract." | "It has to return sentences with a quote each. It returned something else, so nothing was checked and nothing is shown. First 200 chars: `<detail>` in `--font-mono`." | **Try once more** |
| timeout | `--struck` | "No answer in 20 s." | "The server stopped waiting. Nothing was invented to fill the gap." | **Try once more** |
| upstream / no-key / bad-request | `--struck` | "The model call failed (`<code>`)." | "Explain-back keeps working. If you're the developer: `no-key` means `GEMINI_API_KEY` isn't set in this environment." | **Try once more** (not for `no-key`) |
| offline | `--warn` | "You're offline." | "Ask and Quiz need the network. Explain-back doesn't — it never leaves this page." Shown when `navigator.onLine === false` before the call or the fetch rejects with a TypeError. | — |
| fixture (dev only) | `--gen` inline chip **Fixture · localhost** beside the Generated chip | rows as normal | Only rendered when `provider === "fixture"`; production never produces it. The chip's title attribute: "Recorded response replayed by the dev server." |

Every card keeps the previous result visible beneath it at 60 % opacity (§4). The per-run line is always the first
line of a result; the chip sits at its right end.

### 5.5 Quiz surface
Prompt line: "Five questions from the page. Any question your notes can't answer is refused, not shown."
Button **Make quiz**. Loading/error states identical to §5.4 with "Asking" → "Writing quiz".
| State | Screen |
|---|---|
| empty | "No quiz yet." |
| result | Per-run line: `wrote 7 · kept 5 · refused 2` (words `--ink-2`). Kept items: card with question (`--fs-16` 500), four `<button>` options 44 px tall, full width, stacked. |
| answered | Chosen option gets `--ink` 2 px border; correct option gets `--grounded-bg` + chip **GROUNDED · line N**; wrong choice gets `--struck-bg` + chip "YOUR ANSWER". The `statement` renders under the options as a sentence row (§2.3, grounded) and its span lights in the notes pane. Score line at top: "3 / 5 so far" (`--ink-2`). |
| refused item | Collapsed row at the bottom of the list, `--paper` background, `<details>`: summary "Refused · your notes can't answer this" with the `--struck` square; open → the question text in `--ink-2`, the statement as a **struck** sentence row with its reason chip. Never answerable. |
| all refused | Per-run line `wrote 5 · kept 0 · refused 5`; card (`--warn`): "Every question was refused — nothing the model wrote could be traced to a line. Try notes with more concrete statements, or ask again." |
| cached | Same **Cached · HH:MM** treatment as Ask. |

### 5.6 Tally strip (always visible)
`LEDGER` wordmark `--fs-12` uppercase `--ink-2` · three numbers `--fs-24` tabular: **N sentences · M grounded · K
struck** · chip **Rule · Ledger v1.0** · **Reveal struck** switch (`role="switch"`, word on/off). Zero state: "0 · 0
· 0" with "Nothing checked yet" in `--ink-2`; never hidden. Numbers are session totals across all three surfaces.
Under the numbers, `--fs-12` `--ink-2`: "Counted by code from your notes. Same with the model off." (that line is
the video's 1:10 beat spoken in text.)

### 5.7 Footer
Line 1 (`--fs-13`): `Model <name from /api/health>` · `Ledger v1.0` · `<passed>/<total> tests · <date from
web/data/test-results.json>` · link **Source**. Health states: while fetching, "Model: checking…" (`--ink-2`, no
spinner); on failure "Model: health unreachable" in `--warn`; `keyPresent:false` → "Model: no key set" in `--warn`.
Line 2: the tag legend as chips (§6), each with a `title` and a visually-hidden description.
Line 3: `<details>` **How the Ledger is checked** → the calibration table from `npm run calibrate` (30 rows: kind ·
labelled · verdict · reason) with totals "caught X/15 · false strikes Y/15" and the pre-registered margin. **One
row is deliberately spotlighted** with a `--struck` left border and the caption: "This true sentence is struck.
Heavy paraphrase looks invented to the Ledger — it leans toward doubt, and we left it that way." (rule 8: the
visible imperfection.) If T-11 has not landed, the details element is omitted entirely — never a placeholder.

## 6. Epistemic tag legend (PLAN §8) — the chip family with the dashed border
| Chip text | Border / colour | Where | `title` |
|---|---|---|---|
| **Notes** | dashed `--ink`, text `--ink` | notes pane header | "Your text, exactly as pasted. Never altered." |
| **Sample** | dashed `--ink-2`, text `--ink-2` | notes pane header, only for bundled notes | "Bundled sample notes. Source and licence in the file." |
| **Rule · Ledger v1.0** | dashed `--grounded`, text `--grounded` | tally strip, every per-run line | "Verdict computed by code from your notes. Identical with the model off." |
| **Generated · <model>** | dashed `--gen`, text `--gen` | Ask/Quiz per-run line | "Text the model wrote. Always checked, never trusted." |
| **Cached · HH:MM** | dashed `--gen`, text `--gen`, `--font-mono` time | Ask/Quiz per-run line when from cache | "A generated result stored earlier in this browser." |
| **Fixture · localhost** | dashed `--warn`, text `--warn` | dev server only | "Recorded response replayed by the dev server. Impossible in production." |
Verdict chips (`GROUNDED · line N`, `NOT IN YOUR NOTES`) are the solid-bordered family. No other chip kinds exist.

## 7. Mobile (390 px) — the same page, stacked
```
┌────────────────────────────────┐
│ Margin            [Model ● on] │ header 56, sticky
│ 12 · 9 grounded · 3 struck  ◯  │ tally 44, sticky (reveal switch at right)
│ [Notes] [Explain] [Ask] [Quiz] │ segmented control 44, sticky (4 equal segments)
├────────────────────────────────┤
│ (one segment's content)        │ scrolls
│                                │
├────────────────────────────────┤
│ footer (stacked, 3 lines)      │
└────────────────────────────────┘
```
- Breakpoint 900 px: grid collapses; the notes pane becomes the first segment. Concept sentence moves under the
  brand at `--fs-13` (hidden below 360 px only).
- Tapping a sentence row on Explain/Ask/Quiz switches to **Notes** scrolled to the span, and the notes header shows a
  pill **← back to Explain** (44 px) at the top; the browser back button also returns (push a history state).
- Tap targets: every button/switch/option ≥ 44 px; sentence rows ≥ 44 px; chips are not interactive.
- Textarea 5 rows; the action button sits directly under it, full width; no fixed-position buttons (keyboard overlap).
- The signature moment on mobile: strike draws in place on the working segment; the notes scroll happens when the
  student taps the row. Nothing auto-switches segments — the student stays where they typed.

## 8. Performance budget and the technique that holds it
- **First paint < 1 s** on the judge's laptop, cold: zero webfonts, one CSS file < 20 KB, ES modules < 60 KB total
  unminified, no build step, no third-party request before interaction. Sample notes fetched only on click.
- **Strike at 60 fps**: `transform: scaleX` on a pseudo-element (compositor) and a single `text-decoration-color`
  swap; never `width` animation, never per-character spans.
- **Notes pane re-render ≤ 16 ms at 20,000 chars**: one string build with `<mark>` insertions from sorted spans,
  one DOM write; `contain: content` on both panes; `content-visibility: auto` is *not* used (it breaks scroll-to-span).
- **No layout thrash on hover**: `.active` outline only; no measurement in hover handlers.

## 9. Accessibility floor (checked, not hoped)
- Contrast ≥ 4.5:1 for every pair in §1, both schemes. Verdict never by colour alone: strikethrough + chip + square
  + visually-hidden prefix. Highlight never by colour alone: `<mark>` (semantic) + gutter label.
- `prefers-reduced-motion`: all motion off, strike and highlight appear instantly, `scroll-behavior: auto`.
- Font scaling: rem everywhere; 200 % zoom and 20 px root give no horizontal scroll (the notes pane wraps, the tally
  strip wraps to two lines, tabs keep 44 px).
- Keyboard: full operation without a mouse (§4 focus order); tabs use arrow keys; switches toggle on Space.
- Screen readers: `role="tablist"`, `role="switch"`, `aria-live` regions, the notes pane is `<article
  aria-label="Your notes">`, marks announce "highlighted". State cards are `role="status"`.
- No emoji, no icon-only controls, no tooltips that carry the only copy of any information.
- Language: `lang="en"` on `<html>`; sentences are in the student's own language and untouched.

## 10. Thumbnail frame (1280 × 720) — a design deliverable, not a screenshot taken later
- Record at viewport **1440 × 900**, light scheme, browser chrome cropped out. Crop **x 96 → 1376, y 120 → 840**
  (1280 × 720). That crop contains: the notes pane from its second paragraph down (left ~44 %), the tally strip
  reading a real three-number count, and the Explain-back result with the struck sentence.
- Composition rule: the struck sentence (right) and the lit or dashed note line (left) must both sit in the band
  **y 360–520** of the crop. Frontend guarantees this with `scroll-margin-top: 30vh` on marks and by keeping the
  Explain-back result region starting no lower than 320 px below the header at 1440 × 900 (textarea 6 rows, no
  extra margin above the per-run line).
- Content in the frame: one GROUNDED row above the struck row (so the frame shows both outcomes), the struck row's
  chip **NOT IN YOUR NOTES** fully visible, the sub-line `closest line: "…"` visible, the notes pane's dashed
  `.closest` line visible with its gutter label. The header's concept sentence is *outside* the crop on purpose —
  the frame has to work without words; the Devpost gallery line carries the sentence.
- No cursor, no hover state, no browser chrome, no overlaid title. The thumbnail is the product doing the thing.
- The same crop, taken with the model-off banner visible, is the second gallery image.

## 11. Component inventory (vanilla; one file per `web/ui/*` module owns each)
| Component | Class | Owner |
|---|---|---|
| Header + model switch | `.header`, `.switch[role=switch]` | main.js / status.js |
| Notes pane, pane header strip, drop zone, textarea overlay, char counter, `<mark class=span>`, `.closest`, gutter label, absence strip | `.notes*` | ui/notes.js |
| Tally strip + reveal switch | `.tally`, `.tally-num` | ui/tally.js |
| Tabs / segmented control | `.tabs[role=tablist]` | main.js |
| Surface skeleton (prompt line, input, action button, result region, per-run line) | `.surface`, `.run-line` | each ui/*.js |
| Sentence row | `.sentence.verdict-grounded/.verdict-invented`, `.sentence-text`, `.reason` | shared `ui/sentence.js` (new, tiny) |
| Chips (verdict solid, provenance dashed) | `.chip.chip-verdict`, `.chip.chip-tag` | shared |
| State card | `.state.state-<code>[role=status]` | ui/status.js |
| Countdown | `.state-rate-limit-minute .countdown` | ui/status.js |
| What-you-missed list | `.missed` | ui/explain.js |
| Quiz card, option buttons, refused `<details>` | `.quiz-item`, `.option`, `.refused` | ui/quiz.js |
| Footer + calibration `<details>` | `.footer`, `.calibration` | main.js |
| Visually-hidden utility | `.vh` | styles.css |

## 12. Do-not list (banned for this build)
- No gradients, no purple, no glow, no glassmorphism, no "sparkle"/"magic" wording or glyphs, no robot/brain icons.
- No spinners, skeleton shimmer, or indeterminate progress anywhere; loading is a text counter with elapsed seconds.
- No `setTimeout`/`setInterval` to delay or stagger content; stagger is CSS `animation-delay` on a variable.
- No webfonts, icon fonts, SVG icon sets, emoji, or images (the sample notes are text). The only shapes are
  12 px squares, hairlines, and the strike.
- No modal dialogs, `alert`, `confirm`, toasts that auto-dismiss, or tooltips carrying sole meaning.
- No chat transcript layout (no bubbles, no avatars, no "typing…"), no streaming-token effect — sentences appear
  complete because they are checked complete.
- No colour-only verdicts, no green/red without the chip and the line.
- No placeholder text reachable in production ("lorem", "TBD", "coming soon"); if a feature is cut, its copy is
  removed, not greyed.
- No welcome screen, tour, login, or cookie banner. No "Powered by" badge; the model name lives in the footer
  from `/api/health` and nowhere else.
- No auto-switching of tabs/segments after a run; the student stays where they acted.

## 13. Coverage check against the board
- T-12: shell, notes pane (§2.1, §5.2), Explain-back (§5.3), tally (§5.6), footer (§5.7) — specced.
- T-13: Ask (§5.4), Quiz (§5.5), every PLAN §6 code (`model-off`, `cached`, `rate-limit-minute`, `rate-limit-day`,
  `bad-model-output`, `timeout`, `upstream`, `no-key`, `bad-request`, `fixture`), toggles (§5.1, §3.6), footer model
  name — specced.
- T-22 Roadmap (below freeze): reuse the Quiz result skeleton — topic title `--fs-16` 500 + statement as a sentence
  row; INVENTED topics greyed with chip "NOT IN YOUR NOTES", never hidden. Per-run line `N topics · M grounded · K
  not in your notes`. Fourth tab "Roadmap" appears only if the task lands; on mobile the segmented control becomes
  five segments at `--fs-13`.
- T-23 PDF (§5.2 row), T-24 feedback line (§5.3 row), T-25 export: a link-style button **Export session** at the
  end of the tally strip's second line; downloads JSON; disabled with beside-text "Nothing to export" at zero.
- Not specced because no task names it: nothing. No screen in BOARD lacks a section here.
