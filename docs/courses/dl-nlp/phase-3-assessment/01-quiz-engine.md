# P3-01 — Quiz schema, components and grading

**Tag:** `COURSE-P3-01` · **Effort:** M · **Owner:** _tbd_ · **Status:** ✅

## TL;DR

Quiz questions defined in lesson frontmatter, validated by Zod at build time, rendered as
`<Quiz id="…" />` in the prose, graded by a **pure function** on the client. Instant feedback
with an explanation for every answer — right or wrong.

## Context

- P1-02 left `quiz: []` loosely typed as "must be an array". This task defines it properly.
- Definitions go in frontmatter rather than inline JSX so they can be counted, linted, and later
  re-graded server-side without touching the prose.
- Attempt persistence is P4-02. This task grades and displays only; it fires a callback that
  P4-02 wires to the API.

## Files affected

| File | Change |
|------|--------|
| `src/lib/schemas.ts` | + `quizQuestionSchema` (discriminated union), tighten `lessonFrontmatterSchema.quiz` |
| `src/domain/types.ts` | + `QuizQuestion`, `QuizResult`, `QuizAnswer` |
| `src/lib/courses/quiz/grade.ts` (new) | Pure grader — no React, no DOM |
| `src/features/courses/quiz/Quiz.tsx` (new) | Question renderer + submit + feedback |
| `src/features/courses/quiz/questions/*.tsx` (new) | One component per question type |
| `src/lib/courses/mdx-components.tsx` | + `Quiz` |
| `messages/es.json` + `messages/en.json` | + `courses.quiz.*` (**both files**) |
| `scripts/lint-content.ts` | + every `<Quiz id>` in prose resolves to a frontmatter question |

## Question types

| Type | Notes |
|---|---|
| `single` | One correct option |
| `multi` | Several correct; partial credit is **wrong** here — all-or-nothing, and say so in the UI |
| `boolean` | True/false, with a required explanation (a 50% guess needs the explanation to teach) |
| `numeric` | Answer + `tolerance`. Essential for a maths course: "compute ∂L/∂w for these values" |
| `predict-output` | Show Python, ask what it prints. Uniquely good for this course |

Every question carries a mandatory `explanation` field — shown after answering, **whether or not
the answer was correct**. In a rigorous course the explanation is the teaching; the score is not.

```yaml
quiz:
  - id: q-vanishing
    type: single
    prompt: "¿Por qué se desvanece el gradiente en una RNN profunda?"
    options:
      - { id: a, text: "..." }
      - { id: b, text: "..." }
    answer: b
    explanation: "..."
    hint: "Piensa en el producto de derivadas..."   # optional
```

`prompt`, `options[].text` and `explanation` **may contain LaTeX** — this is a maths course and
questions will be mathematical. Render them through the same KaTeX path as the prose.

## Grading

```ts
// pure — no React, no DOM, fully unit-testable
export function gradeQuestion(q: QuizQuestion, answer: QuizAnswer): QuizResult
```

Client-side, immediate. The component calls an `onAnswered(result)` callback that does nothing
in this task; P4-02 attaches persistence to it.

## Acceptance criteria

- [ ] All five types render, accept input and grade correctly
- [ ] LaTeX renders inside prompts, options and explanations
- [ ] `numeric` respects `tolerance`; `0.30000000000000004` matches `0.3` at tolerance `0.001`
- [ ] `multi` is all-or-nothing and the UI states this before submission
- [ ] Explanation shown on both correct and incorrect answers
- [ ] Optional hint is revealable before answering, and revealing it is recorded in the result
- [ ] Retry is allowed; each attempt fires `onAnswered`
- [ ] Malformed quiz frontmatter (missing `explanation`, `answer` not among `options`, duplicate question id) **fails the build**
- [ ] A `<Quiz id>` with no matching frontmatter question fails `lint:content`
- [ ] Keyboard-operable; answered state announced to screen readers
- [ ] Usable at 360px with long LaTeX options
- [ ] All chrome strings via `t()`, keys in **both** message files
- [ ] `pnpm test` + `pnpm build` green

## Test plan

- **Unit (the bulk):** `grade.ts` per type — correct, incorrect, boundary. Specifically:
  numeric tolerance boundaries (exactly at, just inside, just outside), `multi` with a subset
  selected, `multi` with a superset selected, empty answer.
- **Schema unit:** `answer` not in `options` rejected; missing `explanation` rejected; duplicate
  ids within a lesson rejected; unknown `type` rejected.
- **Component:** answering fires `onAnswered` with the right shape; retry resets input but not the attempt count.
- **Manual:** a quiz with heavy LaTeX at 360px; keyboard-only pass.

## Notes / gotchas

- **Never put the answer key in a separate fetched file "for security".** It's a free
  self-assessment course; the complexity would buy nothing and would add a function invocation
  per question. Client-side is the deliberate choice — this note exists so it isn't "fixed" later
  by someone who thinks it's an oversight.
- Numeric comparison: always tolerance-based, never `===`. Authors will write `0.3`.
- Shuffling options is tempting; **don't** — it breaks explanations that say "la opción B" and
  makes reported answers harder to interpret. Authors should vary the correct position manually.
- Keep `Quiz` presentational. All persistence goes through the callback, so P4-02 doesn't have to
  reopen this component.

## Out of scope

- Persisting attempts (P4-02).
- Code challenges (P3-02).
- Scoring, certificates, pass/fail gating on lesson progression.
- Question banks or randomised selection.
