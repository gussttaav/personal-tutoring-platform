# P3-01 — Extract the shared week-grid module

**Tag:** `REFACTOR-R3-P3-01` · **Severity:** 🟠 · **Effort:** L · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

`WeeklyCalendar.tsx` (977 lines) and `AvailabilityModal.tsx` (1,008 lines) carry ~14
near-identical helpers plus the same per-day availability-fetch effect — roughly 900
duplicated lines created when the public modal was "matched" to the calendar (commit
`a54f767`). They've already diverged (`getTimeRowHierarchy` supports `"quarter"` in the
calendar only). Extract a `week-grid` helper module, shared presentational pieces, and a
`useWeekAvailability` hook; make both components consume them.

## Context

Duplicated helpers (same names, near-same bodies):

| Helper | WeeklyCalendar.tsx | AvailabilityModal.tsx |
|--------|-------------------|----------------------|
| `getDayName` | :74 | :40 |
| `getWeekStart` | :80 | :44 |
| `formatDateLabel` / `formatDateKey` | :89/:93 | :60/:53 |
| `formatWeekHeading` | :100 | :64 |
| `getNowMinutes` | :105 | :80 |
| `getTimeRowHierarchy` | :114 (has `"quarter"`) | :92 (no `"quarter"`) — **diverged** |
| `rowBorderTop` / `hourBandBackground` | :122/:139 | :98/:113 |
| `buildTimeRows` | :145 | :119 |
| `isWithinWorkingHours` | :156 | :141 |
| `buildTimeMap` | :168 | :130 |
| `slotStartKey` / `slotStartTime` | :179 | :148 — **naming diverged** |
| `SlotCell` | :834 | :919 |
| `LoadingDots` | :954 | :985 |
| per-day fetch effect | :353 (`atomicMinutes`) | :257 (`ATOMIC_MIN=30`, + AbortController) — **diverged** |

Modal-only: two-step confirm, `buildSelectedSlot`, Escape-to-close, 1h pre-review availability
check (commits `0d9dd00`, `80dfaf6`). Calendar-only: `findContiguousBlock`, `blockToSelectedSlot`,
`LegendDot`, 15-min atomic mode. These stay in their components.

Existing pure helpers to build on (do **not** reimplement): `slotsFromBlocks`,
`isWithinBlocks`, `gridHourRange` in `src/lib/booking-config.ts`.

## Files affected

| File | Change |
|------|--------|
| `src/components/week-grid/helpers.ts` (new) | Date/format/grid pure helpers (superset: `"quarter"` tier kept, parameterized) |
| `src/components/week-grid/SlotCell.tsx`, `TimeColumn.tsx`, `LoadingDots.tsx` (new) | Shared presentational pieces |
| `src/hooks/useWeekAvailability.ts` (new) | Per-day fetch (7 days, `AbortController`, loading/error per day, `atomicMinutes` param) |
| `src/components/WeeklyCalendar.tsx` | Delete local copies; import shared; keep block-selection logic |
| `src/components/AvailabilityModal.tsx` | Delete local copies; import shared; keep modal/confirm logic |

## The change

1. **Helpers first, mechanical:** move the superset implementation of each pure helper into
   `week-grid/helpers.ts`; where the two copies differ, keep the more general one
   (`getTimeRowHierarchy(hhmm, atomicMins)` returning `"hour" | "half" | "quarter"`) and unify
   naming (`slotStartKey`). One import swap per component, zero behavior change intended.
2. **Hook:** `useWeekAvailability({ weekStart, atomicMinutes, tz, schedule })` →
   `{ slotsByDay: Map<string, ApiSlot[]>, loadingDays: Set<string>, errorDays: Set<string> }`.
   Adopt the modal's `AbortController` cleanup (it's the better copy); the calendar gains it for free.
3. **Presentational:** `SlotCell` props become the union of both variants (block-selection
   intensity from `bb11501` included); `TimeColumn`/`LoadingDots` are trivial moves.
4. Keep `ATOMIC_MIN`-style constants in the consumers — the modal is fixed at 30, the calendar
   switches 15/30.

## Acceptance criteria

- [ ] Every helper in the table above exists exactly once, under `src/components/week-grid/` or the hook
- [ ] `WeeklyCalendar.tsx` and `AvailabilityModal.tsx` each shrink by ≥ 300 lines; no copied helper bodies remain
- [ ] Pixel/behavior parity: 30-min public modal grid, 15-min calendar mode, block selection, two-step confirm, Escape-close, past-slot dimming, "now" line — all unchanged
- [ ] Both components abort in-flight fetches on unmount/week-change
- [ ] No new fetches introduced (still ≤ 7 per week view per surface)
- [ ] File-top comment blocks updated with `REFACTOR-R3-P3-01`

## Test plan

- **Existing:** `pnpm test` (component tests if present), `pnpm test:e2e` — the booking e2e suite
  covers both surfaces. ⚠️ Known flakiness: a different single test fails per run; re-run before
  concluding regression (see project memory).
- **New:** unit tests for the extracted pure helpers in `src/components/week-grid/__tests__/helpers.test.ts`
  (`buildTimeRows` boundaries, `getTimeRowHierarchy` for 15/30 grids, `buildTimeMap` tz-differs mode,
  `isWithinWorkingHours` block edges) — these were untested while duplicated.
- **Manual:** side-by-side before/after screenshots of the modal and the calendar at 15-min + 30-min,
  in `es` and `en`, desktop + `<640px` mobile.

## Notes / gotchas

- **This branch (`feat/availability-modal-30min-grid`) is where the duplication lives — land the
  branch first, then refactor on top.** Refactoring mid-feature invites conflicts.
- The `"quarter"` divergence is a live bug factory: the modal's copy renders 15-min rows with
  half-hour hierarchy if it's ever switched to 15-min atomics. The superset helper fixes it by construction.
- `getNowMinutes(tz)` uses `Intl` parts — keep the single shared implementation, it's subtle.
- Respect the i18n rule: no hardcoded customer-facing strings may sneak into the shared components; labels keep flowing from the consumers' `useTranslations`.
- Do NOT touch `booking-config.ts` helpers — they're the pure layer this module composes.

## Out of scope

- Any visual redesign or new grid features.
- `PersonalAreaCalendar.tsx` (823 lines — has its own patterns; evaluate for adoption in a later cycle once the module exists).
- `ZoomRoomSession.tsx` split (explicitly deferred, see PLAN.md).
