# P11-03 — `AUTHORING.en.md`: the English delta

**Tag:** `COURSE-P11-03` · **Size:** S · **Status:** not started

## TL;DR

Write the English half of the authoring contract as a **delta** on `AUTHORING.md`, not a fork.
Most of that file is language-neutral and must stay single-source; four parts of it are Spanish
and have to be replaced. Plus the English terminology glossary the lessons and the widgets both
resolve against.

## Context

`AUTHORING.md` is 1,315 lines and `NOTATION.md` is 1,202. Forking them would double the
maintenance surface of the two documents this course's consistency rests on, and the fork would
start drifting the first time a rule changed. It would also double what has to be in context for
every one of 43 translation sessions.

Most of it does not need forking. The six-step structure (§1), what a lesson may assume (§2), the
budget (§3), notation (§4), the frontmatter reference (§6), components (§7), MDX/LaTeX gotchas
(§8) and the end-to-end checklist (§9–10) are about *this course*, not about Spanish.

Four things are genuinely Spanish, and one of them is not in §5 where you would look for it.

## Files affected

| File | Change |
|---|---|
| `docs/courses/AUTHORING.en.md` | **new** — the delta |
| `docs/courses/AUTHORING.md` | one pointer line at the top: English lessons also read the delta |
| `docs/courses/NOTATION.md` | unchanged — notation is locale-invariant, and saying so is the point |

## The change

### 1. §5 The five marks — two of the five change

| Mark | Spanish rule | English rule |
|---|---|---|
| `**bold**` | term being defined, at its definition, once | unchanged |
| `*italic*` | (a) an **anglicism** on first use per lesson; (b) the word that flips the sentence | (a) is meaningless in English. Replace with: a **term of art on first use**, and loanwords that are still foreign (*a priori*). (b) unchanged. |
| `<W>…</W>` | a string the lesson talks *about* | unchanged — `NOTATION.md` §6 is locale-invariant |
| `«…»` | a word used in its loose, non-technical sense | English does not use angular quotes. Use double quotation marks for the same one job, and **only** that job. |
| `` `code` `` | Python only | unchanged |

The `«…»` → `"…"` swap needs a warning attached: in Spanish, `«»` could only mean the loose sense
because nothing else used them. English double quotes also mean *quotation*, so the mark now has
two jobs — the exact failure the section exists to prevent. The rule for English is therefore
stricter: **the loose sense is the only use of quotation marks in a lesson.** Quoted speech and
quoted output belong in `<W>` or a code fence.

### 2. §5 Person and mood

Spanish distinguishes `tú` (the student, being instructed) from `nosotros` (author and student
following a derivation together), and `AUTHORING.md` assigns each its job. English collapses the
first into an unmarked "you", which removes the register signal but keeps the distinction:

- **"you"** — what the student does, sees, or must decide. Imperatives stay imperative.
- **"we"** — only where the Spanish `nosotros` earned it: a derivation being followed jointly.
  Not as a softener, and never for something only the author did.
- **Contractions** — allowed and preferred in prose (*doesn't*, *isn't*), because the Spanish
  voice is direct and formal English reads as stiffer than the original. Not inside a definition
  or a theorem statement.

### 3. §2 Referring to other blocks and lessons — capitalisation

The rule that is not in §5. `AUTHORING.md` §2 says:

> *In Spanish prose both are common nouns and stay **lowercase** mid-sentence: el bloque 2, la
> lección 3 — never el Bloque 2.*

English treats a numbered division as a name: **Block 2**, **Lesson 3**, capitalised
mid-sentence. Everything else in §2 survives — including the preference for "the previous block"
over "Block 1" when it *is* the preceding one, which survives a renumbering.

### 4. §Terminology — the English glossary

`AUTHORING.md` fixes one word per concept course-wide, and calls out `modelo` / `red neuronal` /
`sistema` as three things that are not synonyms. The English glossary must preserve the same
distinctions, not just translate the entries:

| Spanish | English | Note |
|---|---|---|
| `modelo` | model | |
| `red neuronal` | neural network | never "net" |
| `sistema` | system | |
| `capa oculta` | hidden layer | |
| `descenso de gradiente` | gradient descent | |
| `retropropagación` | backpropagation | one word; never "backprop" in prose |
| `compuerta` | gate | |
| `incrustación` / *embedding* | embedding | Spanish italicises it as an anglicism; English does not italicise it at all after §5's rule change |

The table is completed by the task, not by this doc: the rule is that a term needed by a lesson
is added here **first**, exactly as in Spanish. Terms the widgets show (P11-02) resolve against
this same table, which is why it is a glossary and not a paragraph.

### 5. en-GB, stated once

`-ise` not `-ize`, and the spellings already in the codebase: *tokenisation*, *optimisation*,
*visualiser*, *rigour*, *behaviour*, *normalise*. `course.en.yml` and the widget maths modules
already set this; the delta records it so it survives the first author who did not notice.

Exception, and it is the usual one: **identifiers keep their source spelling.** `normalize.ts` is
a filename, `initialize` is a Python method — code is quoted, not translated.

## Acceptance criteria

- [ ] `AUTHORING.en.md` exists and states, at the top, that `AUTHORING.md` governs except where
      the delta replaces it, section by section
- [ ] All four Spanish-dependent areas are replaced: the two marks, person/mood, §2
      capitalisation, terminology
- [ ] en-GB is stated once, with the identifier exception
- [ ] The glossary covers every term in the Spanish terminology section, preserving its
      distinctions
- [ ] `AUTHORING.md` points at the delta; `NOTATION.md` is untouched
- [ ] The delta is **under 300 lines**. If it is longer, it has started forking.

## Test plan

None — documentation. The check is that B1.1 can be written from `AUTHORING.md` + the delta
without a decision the pair does not cover. Any gap found while writing B1.1 is fixed here, not
worked around in the lesson.

## Gotchas

- **The English budget will read low.** §3 targets 1,200–2,000 words and the lint warns *under*
  budget as well as over, because "a 400-word lesson is usually half a lesson". Spanish runs
  meaningfully wordier than English for the same content, so a faithful transposition of an
  1,800-word lesson can land near 1,500 and warn. The warning is advisory and stays advisory —
  record in the delta that an under-budget warning on a transposed lesson is expected, and that
  the check is whether an argument step went missing, not whether the number went down.
- **Do not restate the six-step structure.** It is the most tempting thing to copy into the delta
  and the fastest way to a fork. Reference it.
- **The two-reader test still applies**, unchanged, and against the **English** neighbours: the
  opening read cold must still say where the course had got to, and read back-to-back with the
  previous English closing, nothing may read twice.

## Out of scope

- Translating `NOTATION.md`. Notation is locale-invariant by design; the one prose-facing part
  (§6, `<W>`) already applies unchanged.
- Any English lesson content.
- Changing a Spanish rule. If the delta exposes a Spanish rule as wrong, that is a separate PR
  against `AUTHORING.md`.
