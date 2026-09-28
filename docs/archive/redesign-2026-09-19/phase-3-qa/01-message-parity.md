# P3-01 — Message-key parity check

**Tag:** `REDESIGN-P3-01` · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** nothing (lands any time; most useful early)

## TL;DR

A script that fails when `messages/es.json` and `messages/en.json` do not have the same key
tree, wired as `pnpm check:messages` and run in CI. CLAUDE.md has said «nothing enforces this
automatically yet — a key present in only one file fails silently at runtime» since the i18n
cycle; this cycle adds ~50 keys across nine tasks, which is the moment to stop relying on care.

## Context

- `CLAUDE.md` → «Internationalization (i18n)»: the rule, and the sentence admitting it is
  unenforced.
- `scripts/lint-content.ts`, `scripts/check-bundle.ts` — the existing `tsx` scripts and their
  `package.json` entries (`lint:content`, `check:bundle`); follow their shape (a `main()`,
  non-zero exit with a readable list).
- `.github/workflows/ci.yml:33-38` — `pnpm lint` then `pnpm lint:content`; the new step goes
  after `lint:content`.
- `messages/*.json` — nested objects; leaves are strings (ICU messages) or arrays of strings
  (`landing.hero.skills`, until P2-01 removes it). Rich-text tags (`<accent>`) are inside string
  values and irrelevant to the key tree.

## Files affected

| File | Change |
|------|--------|
| `scripts/check-messages.ts` | **New.** Load both files, flatten to dotted key paths (arrays count as one leaf), print keys only in `es`, keys only in `en`, and leaves whose *type* differs (string vs array vs object); exit 1 on any difference; also flag an ICU placeholder set that differs between the two values of the same key (`{count}` present in one, absent in the other) as a warning — the runtime rendering bug that is hardest to see |
| `package.json` | `+ "check:messages": "tsx scripts/check-messages.ts"` |
| `.github/workflows/ci.yml` | `+ - name: Check messages` / `run: pnpm check:messages` after «Lint content» |
| `scripts/__tests__/check-messages.test.ts` (or wherever `lint-content` keeps its tests) | Two fixtures: identical trees pass; a missing key and a type mismatch each fail with the key path in the output |
| `CLAUDE.md` | The i18n paragraph: «Nothing enforces this automatically yet» → «`pnpm check:messages` enforces it (CI)» |

## The change

Deliberately small: parity of the key tree plus placeholder parity as a warning. It does not
try to detect untranslated values (an English value under `es` is a review problem, not a
tooling one) and it does not validate ICU syntax (next-intl throws on load for that).

## Acceptance criteria

- [ ] `pnpm check:messages` exits 0 on the current files
- [ ] Temporarily adding `"x": "y"` to one file makes it exit 1 naming `x`
- [ ] Changing a leaf to an array in one file makes it exit 1 naming the key and both types
- [ ] A `{count}` present in one locale's value only produces a warning line, exit 0
- [ ] CI runs it; the CLAUDE.md sentence is updated
- [ ] `pnpm lint`, `pnpm test` green

## Test plan

```bash
pnpm check:messages
pnpm test -- check-messages
```

## Gotchas

- Read the files with `fs`, not `import`, so the script does not depend on `resolveJsonModule`
  settings that differ between `tsx` and Jest.
- Keys with dots inside them do not exist today; do not add escaping for a case nobody has.

## Out of scope

- Detecting untranslated values; validating ICU; a pre-commit hook.
