# P4-01 — Archive the plan, remove the design reference and the command

**Tag:** `REDESIGN-P4-01` · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** every other task ✅ and merged

## TL;DR

The cycle's scaffolding goes: delete `docs/redesign/design/` (mocks, previews, avatar copy),
delete the local `.claude/commands/redesign-task.md`, move the rest of `docs/redesign/` to
`docs/archive/redesign-<date>/` with a `SUMMARY.md`, and add the line to
`docs/archive/INDEX.md`. This is what `/refactor-archive` does for a refactor cycle, done by
hand for this one.

## Preconditions (verify first; stop and list what is missing if any fails)

1. `docs/redesign/STATUS.md` shows every task ✅ with a PR link (or «local» for a squashed
   merge), no ⬜ / 🔄 / ⛔
2. Every phase's exit criteria are ticked
3. The «Cross-phase notes» section has the P3-02 numbers

## Files affected

| Path | Change |
|------|--------|
| `docs/redesign/design/` | **Deleted** — the mocks are superseded by the implementation; they carry a 13 KB copy of the avatar and four previews that would only rot. Anyone who wants the original can open the canvas link kept in `SUMMARY.md` |
| `.claude/commands/redesign-task.md` | **Deleted** locally (`.claude/` is gitignored; the file was never committed) |
| `docs/redesign/` → `docs/archive/redesign-<YYYY-MM-DD>/` | `git mv` of PLAN.md, STATUS.md and the five phase folders; `<date>` = the merge date of the last task |
| `docs/archive/redesign-<date>/SUMMARY.md` | **New** — see below |
| `docs/archive/INDEX.md` | `+ - [redesign-<date>](redesign-<date>/SUMMARY.md) — Home + Mentoría redesign (<start> → <end>, N tasks) — tags `REDESIGN-PN-NN`` at the top of the list |
| `CLAUDE.md` | Confirm the P0-02 gotcha (the shell lives on `/mentoria`, intents travel as `/mentoria?book=`) and the P3-01 sentence (`check:messages`) are the only traces; if a «Where things live» row for the home / Mentoría pages helps a future session, add it (`Add a home section → src/features/home/`, `Change the Mentoría page → src/features/mentoria/`) |

## SUMMARY.md contents

- Date range (start = first task's merge, end = last task's merge)
- The canvas link (`https://claude.ai/artifact/3aqG7h3yJfRDyr1NrG3ZY3`) as the only pointer to
  the original design, with a note that the mocks were deleted from the repo on purpose
- Tasks completed — the table from STATUS.md
- Key wins, 1–3 sentences each: a real home; `/` fully static; Mentoría as a page with
  «Cómo funciona» and testimonials; the message-parity check
- Deviations and known regressions — from «Cross-phase notes»
- Deferred: real store links and the app announcement flow; English testimonials; the blog
  index heading question (P1-03 out of scope)

## Why archive rather than delete the markdown

Every task left a `REDESIGN-PN-NN` comment block in code, as CLAUDE.md requires. Those tags
are only useful if the task file they name can be found; the previous three cycles are in
`docs/archive/` for the same reason. The markdown is ~60 KB. What is deleted — the mocks, the
previews, the command — is what has no reader once the pages exist.

If deleting outright is preferred, replace the `git mv` with `git rm -r docs/redesign` and
skip the SUMMARY; the INDEX line then points at nothing and should be omitted too. Decide
before running the task; do not do half of each.

## Acceptance criteria

- [ ] `ls docs/redesign` → no such directory; `ls docs/archive/redesign-<date>` → PLAN.md,
      STATUS.md, SUMMARY.md, phase-0…phase-4
- [ ] `git ls-files docs/archive/redesign-<date> | grep design/` is empty
- [ ] `docs/archive/INDEX.md` lists the cycle first
- [ ] `test ! -e .claude/commands/redesign-task.md`
- [ ] `grep -rn "docs/redesign" CLAUDE.md docs src` is empty (links inside the archived
      markdown are relative and keep working after the move)
- [ ] `pnpm lint` green (nothing else can change)

## Test plan

```bash
git status --short
git diff --stat
pnpm lint
```

Show the diff summary before committing.

## Out of scope

- Touching any code. If a task left something undone, that is a task to reopen, not cleanup.
