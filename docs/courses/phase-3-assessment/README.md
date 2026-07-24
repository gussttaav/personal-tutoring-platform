# Phase 3 — Assessment

Quizzes and code challenges. Definitions live in lesson frontmatter (structured, validated,
countable); grading happens **client-side** for instant feedback.

Yes, a determined student can read the answers in the bundle. For a free self-assessment course
that is a non-issue, and client-side grading costs zero function invocations. Move grading
server-side only if certificates ever appear — and note that `quiz_attempts` (P4-01) already
records what would be needed to re-grade.

## Tasks

1. [01-quiz-engine.md](01-quiz-engine.md) — `COURSE-P3-01` (M) — schema, components, grading
2. [02-code-challenges.md](02-code-challenges.md) — `COURSE-P3-02` (M) — hidden-assertion challenges on the P2-03 worker

**Landing order:** sequential. P3-02 reuses P3-01's result-reporting shape.

## Exit criteria

- [ ] All five question types render and grade correctly; grader unit-tested as a pure function
- [ ] A code challenge passes/fails against hidden assertions in Pyodide
- [ ] Malformed quiz frontmatter fails the build
- [ ] **Walking skeleton:** lesson 1 of Block 0 is complete end-to-end — prose + display math + one explorable + one NumPy cell + one quiz — and reads correctly on a phone
- [ ] `pnpm test` + `pnpm build` green

## Why the skeleton criterion lives here

Phases 1–3 exist to make authoring fast. None of it should be called done until one real lesson
has actually been through the loop. If authoring that lesson reveals friction, fix it **now** —
before writing the other thirty-nine.
