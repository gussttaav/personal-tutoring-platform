# P6-03 — Publication gate + Navbar/Footer link swap

**Tag:** `COURSE-P6-03` · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Flip the switch: courses become publicly reachable, and the Navbar/Footer "Cursos" links point at
`/cursos` instead of opening the ComingSoonModal. Small task, but it is the moment the feature
ships — and the gate it formalises is what keeps `main` mergeable during the months of P5.

## Context

- `src/components/Navbar.tsx:33` — `{ label: t("courses"), href: "#", comingSoon: "courses" }`
- `src/components/Footer.tsx:125` — same pattern for both Cursos and Blog
- `src/components/ComingSoonModal.tsx` — takes `type: "courses" | "blog"`. **Blog must keep
  working**; only the courses branch is retired.
- P1-02 routed all publication filtering through a single predicate in the registry. This task
  defines the global half of that predicate.

## The gate

Introduce the gate in **P1-02** (as a constant defaulting to "hidden") and flip it here. Two
independent conditions, both required for a lesson to be public:

1. `draft: false` in the lesson frontmatter — per-lesson
2. The global courses gate is on — per-environment

Implement the global gate as an **environment variable** (`NEXT_PUBLIC_COURSES_ENABLED`), not a
DB flag: it must be readable at build time by `generateStaticParams` and the sitemap, and it
needs no runtime mutability. That also allows preview deployments to run with courses enabled
while production stays dark — which is how P5 gets reviewed for months without going public.

Document the variable in `README.md` alongside the other env vars. **Do not add it to
`src/lib/startup-checks.ts`** — that file deliberately lists only variables whose absence is a
hard failure, and explicitly excludes optional ones with in-code fallbacks (see its module
comment). An absent gate means "courses off", which is a valid state, not a misconfiguration.

## Files affected

| File | Change |
|------|--------|
| `src/lib/courses/registry.ts` | Read the gate in the single publication predicate (added P1-02) |
| `src/components/Navbar.tsx` | Courses → `/cursos` when enabled; ComingSoonModal otherwise |
| `src/components/Footer.tsx` | Same |
| `src/components/ComingSoonModal.tsx` | Untouched — blog still uses it |
| `README.md` | Document `NEXT_PUBLIC_COURSES_ENABLED` |
| `e2e/` | Nav-to-course smoke test |

**Keep the courses branch of `ComingSoonModal` in place.** Deleting it is a separate cleanup, and
keeping it means the gate can be turned back off if something is badly wrong at launch. Note it
on the maintenance list instead.

## Acceptance criteria

- [ ] Gate off: `/cursos` is not linked anywhere; lessons absent from the sitemap; the ComingSoonModal behaves exactly as before
- [ ] Gate on: Navbar and Footer link to `/cursos` in both desktop and mobile menus
- [ ] **Blog still opens the ComingSoonModal in both places** — verify explicitly, it's the easy thing to break here
- [ ] Direct navigation to `/cursos` with the gate off returns 404, not a broken page
- [ ] Env var documented in `README.md`
- [ ] Preview deploys can enable courses independently of production
- [ ] `pnpm test` + `pnpm build` green with the gate both on and off

## Test plan

- **Unit:** the registry publication predicate — gate off → `listCourses` returns `[]` regardless
  of `draft`; gate on → drafts still filtered.
- **Component:** Navbar/Footer render the link when enabled and the modal trigger when not.
- **Build:** run `pnpm build` in both states; confirm lesson routes are absent from the manifest
  when the gate is off.
- **E2E:** click Cursos in the nav → lands on `/cursos` → click the course → lands on the landing
  page → click "Empezar" → lands on lesson 1. (Suite is known to be timing-flaky; re-run once
  before treating a failure as a regression.)
- **Manual:** mobile menu, both states, both locales.

## Notes / gotchas

- `NEXT_PUBLIC_*` is inlined at build time, so **flipping it requires a redeploy**, not just an
  env change. Expected and fine — but know it before launch day.
- The English nav will link to `/en/cursos`, which shows an empty catalog while there's no English
  content. Confirm the empty state (P1-03) reads sensibly there — an English visitor clicking
  "Courses" and getting a blank page is a bad first impression. Consider a note pointing at the
  Spanish version.
- Don't remove the courses subscription flow. Someone landing on the blog modal may still want
  course updates, and the `subscriptions` rows stay meaningful.
- Order matters: land this **before** P6-02. Never email a link that isn't live.

## Out of scope

- Removing the courses branch of `ComingSoonModal` (cleanup, later).
- The blog (still coming soon).
- Any per-course gating — this is one global switch. Per-course visibility is `draft` at the
  lesson level plus not listing the course in the registry.
