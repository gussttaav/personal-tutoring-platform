# Phase 2 — Performance

The course and blog features are built well on their own: MDX/KaTeX/Shiki compiled at build time,
widgets code-split with `next/dynamic`, route-scoped CSS, a prerendered search index, batched
progress reads. The cost is in the **shared shell** those pages run inside. The audit measured it on
the existing `.next` build:

- **P2-01:** 32 of 43 API lambdas ship a **10.1 MB** `googleapis` chunk, including the NextAuth
  session route every page calls. One import in `CalendarClient.ts` pulls in all ~300 Google APIs.
- **P2-02:** every page preloads a **3.9 MB** icon font for fewer than 100 icons, and every page
  bundles Sentry Session Replay eagerly. Sentry is ~186 KB of the 352 KB gzipped JS on a static
  blog post.
- **P2-03:** the root layout loads prices and the booking schedule from Supabase for all ~108
  routes. Every lesson and post therefore depends on Supabase at build time and is invalidated by
  every admin price or schedule edit. `UserPricingSync` also fetches `/api/pricing` on every page
  for signed-in users.
- **P2-04:** each `useUserSession()` call site keeps its own credit state. Booking pages fetch
  `/api/credits` twice, and the Navbar badge goes stale after an in-overlay pack booking.

**Order:** P2-01 and P2-02 are independent of everything, so land them first for the biggest wins.
**P2-03 before P2-04.** Phase 2 is independent of Phase 1.

**Measure before and after every task, on your own build,** and put both numbers in the PR. The audit's
figures come from the main checkout's build of 2026-09-27 and are approximate for any other branch.

## Tasks

1. [01-googleapis-calendar-only.md](01-googleapis-calendar-only.md): `REFACTOR-R4-P2-01` (🟠, S)
2. [02-shell-weight-font-sentry.md](02-shell-weight-font-sentry.md): `REFACTOR-R4-P2-02` (🟠, M)
3. [03-commerce-providers-scope.md](03-commerce-providers-scope.md): `REFACTOR-R4-P2-03` (🟡, M)
4. [04-single-user-session-state.md](04-single-user-session-state.md): `REFACTOR-R4-P2-04` (🟡, S)

## Exit criteria

- [x] No API lambda traces a chunk containing the full `googleapis` catalog; the largest server chunk in `/api/courses/progress`'s trace is < 2 MB
- [x] Icon font ≤ 150 KB; `pnpm check:icons` green in CI; visual pass shows no ligature-text icons
- [x] **Missed, accepted:** blog-post first-load gzipped JS down ≥ 60 KB (got −38.5 KB, see STATUS.md); Lighthouse mobile LCP on `/` and a post recorded before/after (median of 3)
- [x] No blog/lesson/course `.meta` lists `pricing-all` or `schedule-config`
- [x] Signed-in page load: one `/api/credits`; no `/api/pricing` on lessons and posts
- [x] `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm check:messages` green; e2e home + booking + courses specs green

## Relation to prior cycles

- `PERF-11` widened the pricing/schedule ISR window to 30 days to cut the regeneration cost. P2-03 removes the coupling that made it expensive.
- `BUILD-01…04` worked around prerender reads of pricing/schedule failing (PGRST303). After P2-03 only ~7 routes make those reads.
- `QUAL-06` (visibility-refetch cooldown) is preserved by P2-04, just once instead of per call site.
- `REFACTOR-P4-03` (Sentry release tagging, cycle 2) is untouched by P2-02.
