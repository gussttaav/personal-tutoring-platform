# P0-02 — Deep links, emails and e2e retarget

**Tag:** `REDESIGN-P0-02` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P0-01 (the target route must exist)

## TL;DR

Every link, redirect, OAuth callback and test that carries a booking intent to `/` now carries it
to `/mentoria`. The mechanism is untouched — `InteractiveShell` still reads `?book=`,
`useRescheduleIntent` still reads `?reschedule=…&token=…`, `useBookingRouter` still restores
`?intent=` / `?action=` after Google sign-in — only the path in front of the query changes.
Write the rule into `CLAUDE.md` so no later change reintroduces a `/?book=`.

## Context

Inventory, from `grep -rn '/#sessions\|/?book=\|/?reschedule=\|/?intent=\|/?action=' src e2e`
plus the email template (P0-01 already removed the navbar/footer/author-note ones):

**Booking intents (`?book=`)**
- `src/features/personal-area/UpcomingTab.tsx:39` — `router.push("/?book=free15min")`
- `src/features/personal-area/PackBanner.tsx:87` — `router.push("/?book=pack")`
- `src/features/personal-area/PastClassModal.tsx:332` — `` router.push(`/?book=${entry.sessionType}`) ``
- `src/features/personal-area/CourseProgressCard.tsx:80` — `<Link href="/?book=session1h">`
- `src/features/personal-area/BookSessionsPanel.tsx:45,68,88` — `/?book=pack`, `` /?book=${key} `` ×2
- `src/features/courses/reader/LessonCta.tsx:46` — `<Link href="/?book=smart" rel="nofollow">`
  (its header comment `:14-25` documents the `?book=` bridge; update the prose)

**Reschedule intents (`?reschedule=…&token=…`)**
- `src/features/personal-area/UpcomingTab.tsx:119`, `NextClassHero.tsx:85` — `router.push`
- `src/infrastructure/resend/email-functions.ts:147-152` — `RESCHEDULE_PATHS` (four entries,
  all `/?reschedule=…`) used at `:182` for the confirmation email's «reprogramar» link
- `e2e/reschedule.spec.ts:61` — `` page.goto(`/?reschedule=free15min&token=…`) ``; `:80` comment
  «the URL stays at "/"»

**OAuth restore (`?intent=`, `?action=`)** — `src/hooks/useBookingRouter.ts:253,262,272,298`
build `setSignInCallbackUrl("/?intent=…")` / `"/?action=schedule-pack"` (documented `:15-20`);
`src/app/[locale]/pago-exitoso/page.tsx:93` — `router.push("/?action=schedule-pack")` after a
pack purchase; `src/components/SignInGate.tsx:78` defaults `callbackUrl` to `"/"`;
`src/components/Navbar.tsx:63` and `src/hooks/useSubscription.ts:65` call
`signInWithPopup("/")` (plain sign-in, no booking intent — see «The change»).

**Post-action navigation back «home»** — `sesion-confirmada/page.tsx:198,231`,
`pago-exitoso/page.tsx:66,177`, `cancelar/page.tsx:90,145,167` push `/`. These say «Volver al
inicio»: after this cycle `/` IS the home, so they stay.

**E2E** — `booking-free.spec.ts:28`, `chat.spec.ts:35,44,54,72` — `page.goto("/")` then interact
with the booking shell or the chat FAB (the FAB is mounted by `InteractiveShell:540`);
`booking-single.spec.ts` and `booking-pack.spec.ts` — read their setup, they reach the shell
through the same `goto("/")` or a helper in `e2e/helpers/`.

**CLAUDE.md** — «Gotchas» has no entry about where the booking shell lives.

## Files affected

| File | Change |
|------|--------|
| The nine `src/features/**` files above | `/?book=` → `/mentoria?book=`, `/?reschedule=` → `/mentoria?reschedule=`; `LessonCta.tsx` comment updated («the landing» → «/mentoria») |
| `src/infrastructure/resend/email-functions.ts` | `RESCHEDULE_PATHS` values → `/mentoria?reschedule=…`; the `?? "/"` fallback at `:182` → `"/mentoria"` |
| `src/hooks/useBookingRouter.ts` | The four callback literals → `/mentoria?…`; header comment `:15-20` updated |
| `src/app/[locale]/pago-exitoso/page.tsx:93` | → `/mentoria?action=schedule-pack` |
| `src/components/SignInGate.tsx:78` | Default `callbackUrl` → the current pathname (`usePathname()` from `@/i18n/navigation`), not `"/"` — the gate is only ever mounted by the shell, and after P1-04 that is `/mentoria` |
| `e2e/booking-free.spec.ts`, `booking-single.spec.ts`, `booking-pack.spec.ts`, `chat.spec.ts`, `reschedule.spec.ts` (+ any helper in `e2e/helpers/` that opens the landing) | `goto("/")` → `goto("/mentoria")`; the reschedule URL; comments that say «the URL stays at "/"» |
| `CLAUDE.md` | Gotcha: «The booking shell (`InteractiveShell`: sessions, packs, calendar, overlays, chat FAB) is mounted on `/mentoria` only. Cross-page booking intents travel as `/mentoria?book=<free15min\|session1h\|session2h\|pack\|pack5\|pack10\|smart>` or `/mentoria?reschedule=<type>&token=…`; OAuth restores use `/mentoria?intent=…` / `?action=…`. Never link to `/?book=`.» Also fix the «Where things live» table if it mentions the landing |
| `messages/es.json` `:1628` (`creditsRestoredMsg`) and its `en` twin | Leave — the link says «gustavoai.dev» and the home is one click from the booking; noted here so nobody hunts for it |

## The change

Mechanical, with two judgement calls:

1. **`SignInGate`'s default callback.** Today `"/"` is right because the gate only exists on
   `/`. Rather than hardcode `/mentoria`, default to the current pathname: correct on
   `/mentoria`, still correct if the gate is ever mounted elsewhere, and it removes one more
   `"/"` literal. `useBookingRouter` keeps its explicit literals because they encode intents.
2. **Plain sign-in stays on `/`.** `Navbar.tsx:63` and `useSubscription.ts:65` sign the user in
   with no booking intent; returning to `/` (the future home) is the right default. Do not
   change them.

The `next=` parameter of `signInWithPopup` and the `popup-callback` page are path-agnostic; no
change there. `useRescheduleIntent` and the `?book=` consumer in `InteractiveShell` read
`window.location` / `useSearchParams` on whatever page the shell is mounted — unchanged.

## Acceptance criteria

- [ ] `grep -rn '"/?\|`/?\|/#sessions' src e2e` returns nothing that is a booking/reschedule/
      intent path (remaining `"/"` literals are the plain «home» navigations listed above)
- [ ] From `/area-personal`, «Reservar» on an upcoming/past class and the pack banner land on
      `/mentoria` with the right overlay open; from a lesson, the in-lesson CTA opens the smart
      booking on `/mentoria`
- [ ] A confirmation email's «reprogramar» link is `https://gustavoai.dev/mentoria?reschedule=…&token=…`
      (assert in the email-functions test that renders it, if one exists; otherwise add the
      assertion to `src/infrastructure/resend/__tests__/`)
- [ ] Signing in from a session card on `/mentoria` returns to `/mentoria?intent=…` and the
      booking resumes (manual, staging)
- [ ] After a pack purchase, «Reservar ahora» on `/pago-exitoso` opens pack scheduling on
      `/mentoria`
- [ ] The five e2e specs pass against staging
- [ ] `CLAUDE.md` carries the gotcha
- [ ] `pnpm lint`, `pnpm test`, `pnpm build` green

## Test plan

```bash
pnpm lint
pnpm test
pnpm build
E2E_BASE_URL=<staging> pnpm test:e2e -- booking-free booking-single booking-pack reschedule chat
```

Manual on staging, signed in: personal area → «Reservar otra clase»; a lesson → the CTA; the
pack-purchase success page; the reschedule link from a real confirmation email.

## Gotchas

- `e2e/` reads message dictionaries from `messages/*.json` for labels; the shell's labels do not
  change, only the URL.
- The email tests may mock `getTranslations` (see memory: email templates are untestable in
  Jest without mocking); assert on the rendered `href`, not the copy.
- `reschedule.spec.ts:80` says free-session success «stays at "/"»: that becomes «stays at
  `/mentoria`».
- The `rel="nofollow"` on `LessonCta` stays — the reason (`?book=smart` is a crawl signal worth
  not sending) is unchanged.

## Out of scope

- Changing what the intents do.
- `creditsRestoredMsg`'s bare `{baseUrl}` link.
- The home's own CTAs (P1-01), which will be the first *new* links to `/mentoria`.
