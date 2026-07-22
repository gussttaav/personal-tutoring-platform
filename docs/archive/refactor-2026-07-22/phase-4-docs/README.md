# Phase 4 — Docs

Single docs-only task: CLAUDE.md (and a couple of code comments) have drifted from shipped
reality. Since CLAUDE.md drives both human onboarding and agent behavior, drift here causes
real bugs — e.g. an agent "knowing" there's no `users.locale` column would design around a
column that exists and is load-bearing for email localization.

Runs last so the docs describe the post-refactor state (Postgres slot locks, new limiters,
week-grid module).

## Tasks

1. [01-claude-md-drift.md](01-claude-md-drift.md) — `REFACTOR-R3-P4-01` (🟢, S)

## Exit criteria

- [ ] CLAUDE.md contains no statement contradicted by the code (spot-audit the Gotchas + Data Storage sections)
- [ ] `csrf.ts` exemption comment names only live routes
- [ ] The ZoomRoomSession-split deferral is recorded once, in PLAN.md, not re-litigated
