# Phase 4 — Cleanup

Everything that existed only to get the redesign built leaves the working tree: the design
reference (the mocks and previews), the local `/redesign-task` command, and this plan — which
is archived under `docs/archive/`, as every finished cycle in this repo is, so the
`REDESIGN-PN-NN` tags left in code comments keep pointing at a task file that exists.

## Tasks

1. [01-archive-and-remove.md](01-archive-and-remove.md) — `REDESIGN-P4-01` (S)

## Exit criteria

- [ ] `docs/redesign/` does not exist
- [ ] `docs/archive/redesign-<YYYY-MM-DD>/` holds PLAN, STATUS, the phase folders and a
      `SUMMARY.md`; `docs/archive/INDEX.md` lists it; the `design/` folder is NOT in the archive
- [ ] `.claude/commands/redesign-task.md` is deleted (local file; nothing to commit)
- [ ] `CLAUDE.md` mentions the two pages and the deep-link rule, and nothing else about this
      cycle
