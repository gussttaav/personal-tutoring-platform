# P3-02 — Code challenges with hidden assertions

**Tag:** `COURSE-P3-02` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

"Implement `softmax(x)` so these tests pass." A `<CodeChallenge>` cell with starter code,
hidden `assert`s run in the P2-03 Pyodide worker, and pass/fail feedback per test. This is the
strongest assessment format for a from-scratch deep learning course — and it costs nothing to
run, because it executes in the student's browser.

## Context

- Builds directly on P2-03's worker + client. No new execution infrastructure.
- Reuses P3-01's result-reporting shape so P4-02 wires one persistence path, not two.
- This is the phase's marquee feature: it's what makes "implement backprop yourself" checkable.

## Files affected

| File | Change |
|------|--------|
| `src/features/courses/code/CodeChallenge.tsx` (new) | Starter code, Run tests, per-test results |
| `src/lib/courses/pyodide/run-tests.ts` (new) | Wrap student code + assertions, parse structured results |
| `src/lib/schemas.ts` | + `codeChallengeSchema` in lesson frontmatter |
| `src/domain/types.ts` | + `CodeChallenge`, `TestResult` |
| `src/lib/courses/mdx-components.tsx` | + `CodeChallenge` |
| `messages/es.json` + `messages/en.json` | + `courses.challenge.*` (**both files**) |

## The change

**Frontmatter definition:**

```yaml
challenges:
  - id: ch-softmax
    prompt: "Implementa softmax numéricamente estable."
    starter: |
      import numpy as np
      def softmax(x):
          # tu código aquí
          pass
    tests:
      - name: "suma 1"
        code: "assert np.isclose(softmax(np.array([1.,2.,3.])).sum(), 1.0)"
      - name: "estable con valores grandes"
        code: "assert not np.isnan(softmax(np.array([1000., 1001.])).sum())"
    solution: |
      ...
    explanation: "..."
```

**Execution:** run the student's code, then each test **independently** so one failure doesn't
mask the rest. Report per-test name + pass/fail + the assertion message on failure. Wrap each
test in a try/except that emits a structured result rather than aborting the run.

**Feedback quality is the whole point.** `AssertionError` alone teaches nothing. Show the test
name, what was expected where the assertion makes it available, and the traceback for genuine
errors (a `NameError` is different from a wrong answer and should read differently).

**Solution reveal:** available after **either** all tests pass or ≥3 failed attempts. Not
immediately — the struggle is where the learning is — but not locked forever either, because a
stuck student who can't move on just leaves.

**Reuse the timeout** from P2-03 unchanged. A student's buggy loop is *more* likely here than in
a demo cell, so the terminate path gets exercised for real.

## Acceptance criteria

- [ ] Starter code loads; edits run against the hidden tests
- [ ] Each test reports independently; a failure in test 1 does not prevent test 2 running
- [ ] A `NameError` / `SyntaxError` in student code reads differently from a failed assertion
- [ ] All tests passing shows a clear success state and fires `onAnswered` (P4-02 hook)
- [ ] Solution revealable after all-pass or ≥3 failures; not before
- [ ] Infinite loop in student code hits the P2-03 timeout, tab stays responsive, next Run works
- [ ] Reset restores starter code
- [ ] Frontmatter validated at build: empty `tests`, missing `starter`, duplicate challenge id → build fails
- [ ] Usable at 360px (the editor is the hard part on mobile — verify on a real device)
- [ ] All chrome strings via `t()`, keys in **both** message files
- [ ] `pnpm test` + `pnpm build` green

## Test plan

- **Unit:** `run-tests.ts` wrapper generation and result parsing against captured worker output
  fixtures — passing suite, single failure, syntax error, timeout. Pure string/protocol work, no
  Pyodide needed.
- **Schema unit:** the malformed-frontmatter cases above.
- **Manual:** one real challenge (`softmax`) end to end — correct solution, wrong solution,
  syntax error, infinite loop. On desktop and a real phone.

## Notes / gotchas

- **"Hidden" tests are only hidden from the page, not from the bundle.** Same reasoning as P3-01:
  fine for self-assessment, stated here so it isn't mistaken for an oversight.
- Don't let a student's code shadow the test harness — run tests in a fresh namespace that
  imports the student's definitions, rather than `exec`ing everything into one global scope.
- Keep challenges small: one function, 2–4 tests. A multi-function challenge in a textarea editor
  on a phone is not a good experience, and this course's challenges should reinforce one idea each.
- Authoring note for P5: every challenge needs a **verified reference solution**. A challenge
  whose own solution doesn't pass its tests is the worst possible bug here — the content lint
  should eventually run the reference solutions, though that is not required by this task.
- Mobile editing is genuinely awkward. Consider making challenges "read on mobile, solve on
  desktop" and saying so, rather than pretending the phone experience is equivalent.

## Out of scope

- Persisting attempts or submitted code (P4-02 persists the *result* only).
- Auto-verifying reference solutions in CI (nice future addition to `lint:content`).
- Any server-side execution — permanently out of scope.
- Multi-file or multi-function project-scale exercises; those are Colab notebooks.
