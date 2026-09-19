# Phase 3 — QA

Two tasks that verify the whole rather than a section: a guard for the one thing this cycle
does most (add message keys) and a pass over the suites and the performance of the two pages.

## Tasks

1. [01-message-parity.md](01-message-parity.md) — `REDESIGN-P3-01` (S) — `pnpm check:messages`,
   in CI
2. [02-e2e-and-perf.md](02-e2e-and-perf.md) — `REDESIGN-P3-02` (M) — the e2e suite on staging,
   the build route table, Lighthouse on both pages

**Landing order:** 01 can land any time after P0-02 (it only reads the message files); 02 after
P2-04.

## Exit criteria

- [ ] `pnpm check:messages` fails on a key present in one file only and passes on the tree as
      merged; `ci.yml` runs it after `lint:content`
- [ ] The full e2e suite passes against staging (a flake re-run is fine; a test that fails twice
      is a regression to fix, not to skip)
- [ ] `pnpm build`: `/[locale]` ○, `/[locale]/mentoria` ƒ or ○ as the shell dictates (the same
      class the old `/` had); `check:bundle` unchanged except the known pyodide false positive
- [ ] Lighthouse mobile on `/` and `/mentoria`: Performance and Accessibility not below the
      pre-cycle landing's scores, recorded in STATUS
