# gustavoai.dev — Project Context

## Stack
Next.js 16 (App Router) · React 19 · TypeScript strict · NextAuth v5 · Supabase (Postgres) ·
Stripe · Google Calendar · Zoom Video SDK · Upstash Redis (ephemeral only) ·
Gemini · Resend · Sentry

## Architecture

### Layered Structure
```
src/
├── app/            Route handlers (thin — parse input, call service, format response)
├── domain/         Pure types, interfaces, error classes (zero external dependencies)
├── services/       Business logic (depends on domain only, injected infrastructure)
├── infrastructure/ External system adapters (Supabase, Stripe, Google, Zoom, etc.)
├── lib/            Shared utilities (schemas, validation, logger, rate limiting)
├── components/     React components
├── features/       Feature-specific page components
├── hooks/          React hooks
└── constants/      Static configuration and design tokens
```

### Data Storage

- **Supabase (Postgres)** is the source of truth for all persistent data:
  users, credit_packs, bookings, zoom_sessions, payments, audit_log, pricing.
- **Redis (Upstash)** is used ONLY for ephemeral state:
  rate limiting (`rl:*`), in-session chat (`chat:session:*`),
  availability + schedule-config cache (`avail:*`, `schedule:config:*`).
- **Slot locking is a Postgres concern**, not Redis: the `slot_locks` table via the
  `acquire_slot_lock` / `release_slot_lock` RPCs.
- **Never store persistent data in Redis.** If it matters after a page refresh, it goes in Supabase.

### Repository Pattern
All data access goes through interfaces in `src/domain/repositories/`.
Implementations live in `src/infrastructure/supabase/`. Services receive
repositories via constructor injection — this is what makes them testable.

```
Route handler → Service → Repository interface → Supabase implementation
                                              └→ In-memory implementation (tests)
```

### Service Layer
Business logic lives in `src/services/`:
- `CreditService` — credit operations, atomic decrement via Postgres stored procedure
- `BookingService` — orchestrates credits + calendar + Zoom + email
- `PaymentService` — Stripe checkout, webhook processing, dead-letter recovery, the reconcile cron (`reconcileRecentPayments`)
- `BookingPaymentAuditService` — daily read-only audit that every upcoming class is backed by its payment
- `PricingService` — admin-editable session/pack prices; single source of truth for charge amounts and display
- `SessionService` — Zoom session lifecycle, JWT issuance, in-session chat
- `ChatService` — Gemini AI chat
- `AdminService` — admin panel reads (over `IAdminQueryRepository`) + manual credit adjustments

Route handlers are thin dispatchers: parse input → call service → map errors to HTTP.
Domain errors (`src/domain/errors.ts`) are mapped to HTTP via `src/lib/http-errors.ts`.

## Conventions
- Zod schemas in `src/lib/schemas.ts` — never inline in route handlers.
- Structured logging via `log()` from `src/lib/logger.ts` — no `console.*`.
- Customer-facing UI + emails are **bilingual (Spanish + English)** via `next-intl` — see the i18n section below. The **admin panel stays Spanish** (out of scope for translation).
- CSRF protection via `isValidOrigin()` on all POST routes (except Stripe webhook).
- Admin routes gated by `isAdmin()` from `src/lib/admin.ts`.

## Internationalization (i18n)

The customer-facing app is bilingual: **Spanish is the default** (unprefixed URLs), **English lives under `/en`** (`next-intl`, `localePrefix: 'as-needed'`). Routing/config in `src/i18n/`.

Locale has two sources, by design: the `NEXT_LOCALE` cookie drives **rendering** (which URL/locale the visitor sees), while **`users.locale`** (migration `0010_user_locale.sql`) is the account-level source of truth used by background flows that have no request context — e.g. the emails `BookingService` sends from the Stripe webhook. The two are reconciled at login by `UserService.seedLocaleOnLogin`, and an explicit switch persists via `setLocale`.

**The rule for any UI/email text change:**
- Never hardcode customer-facing strings in components. Add a key to **both** `messages/es.json` **and** `messages/en.json` (identical key structure, translated values) and render it with `t()` from `useTranslations(...)` (client) or `getTranslations(...)` (server).
- The two files must stay **key-for-key in sync.** `pnpm check:messages` enforces it (CI) — a key present in only one file fails silently at runtime for that locale. Always edit both.
- Domain/validation errors carry **codes**, not localized strings; the presentation layer translates them (`src/constants/errors.ts` → `errors.{http,domain,validation}.*`). Add new error copy under those namespaces, not inline.
- Admin panel text may stay Spanish (hardcoded is acceptable there).
- New public page? Add `generateMetadata` with `localizedAlternates(route, locale)` from `src/lib/hreflang.ts`, list it in `src/app/sitemap.ts`, and leave auth/transactional pages out (they're disallowed in `src/app/robots.ts`).

## Gotchas
- NextAuth v5 is in beta. Session shape: `session.user.email`, `session.user.name`.
- Upstash Redis REST API does NOT support MULTI/EXEC — use Lua via `kv.eval()`.
- Vercel serverless functions cap at 25s (Hobby) / 60s (Pro). SSE uses 24s.
- All Zoom session cleanup is recorded to `pending_terminations` at booking time; the daily cron at `/api/internal/session-cleanup` handles the actual termination.
- Vercel plan is **Hobby** — no native Vercel crons. Scheduled tasks use cron-job.org instead: `/api/internal/session-cleanup`, `/api/internal/reconcile-stripe` and `/api/internal/booking-payment-audit`, each a GET behind `Authorization: Bearer <CRON_SECRET>`.
- Zoom Video SDK != Zoom Meetings API. JWT signing only; no REST for session mgmt.
- `GOOGLE_PRIVATE_KEY` needs `\\n` → `\n` replacement (handled in CalendarClient.ts).
- Supabase TIMESTAMPTZ format differs from JS `toISOString()`:
  - JS: `"2026-04-21T10:04:43.130Z"`
  - PostgREST: `"2026-04-21T10:04:43.13+00:00"`
  **Rule:** always normalize with `new Date(dbTimestamp).toISOString()` before comparing or signing.
- Credit atomicity uses a Postgres stored procedure (`decrement_credit`), not application-side logic.
- Prices are NOT in Stripe. The four public prices live in the Supabase `pricing` table, edited at `/admin/pricing`; a student may have **private overrides** in `user_pricing` (migration `0022`, sparse: a row only for an overridden product, edited on `/admin/students/<email>`). `PricingService.resolve(userId)` is the ONE merge point: the charge (`getAmount`) and the display (`getPublicPricing`, `GET /api/pricing` → `hasCustomPricing`) both read through it. The static pages show public prices (`src/lib/pricing-display.ts` → the `PricesProvider` context), and `UserPricingSync` (inside `CommerceProviders`) overlays a signed-in student's own; the mobile app reads `GET /api/pricing`. Don't reintroduce `STRIPE_PRICE_ID_*`. The pack "original/strikethrough" price is derived (`1h price × hours`), never stored.
- Pack expiration is NOT hardcoded (was `PACK_VALIDITY_MONTHS = 6`). It lives in the Supabase `pricing_settings` singleton as `pack_validity_days` (migration `0020`, default 180), edited at `/admin/pricing` alongside the prices. `PricingService.getPackValidityDays()` reads it; the purchase path (`PaymentService.handlePackPayment`, admin manual grant) computes `expires_at = now + days` and freezes it on each `credit_packs` row (**write-once** — changing the setting affects only future purchases). It rides the same ISR cache as prices (`getPackValidityDays()` in `pricing-display.ts`, `PRICING_CACHE_TAG`), reaches the web via `usePackValidityDays()` on `PricesProvider`, and the mobile app via `packValidityDays` on `GET /api/pricing`.
- **A course's completeness is declared, not derived from the files on disk** (`COURSE-BUILD-01`). Each block in `content/courses/<slug>/course.es.yml` carries `lessons: N`, its PLANNED lesson count — the one thing that can answer "is the Spanish course finished?", since the manifest's block list is complete from day one. `courseBuildStatus()` (`src/lib/courses/course-build.ts`, pure) measures the published spine against it: a block is `upcoming` / `partial` / `complete`, and the course is complete when no block is either of the first two. A block with no `lessons:` counts as complete once it has one published lesson, which is why `dl-nlp` (finished before the key existed) needed no change. The counts are **locale-invariant like block `id`** — `catalog-view.ts` reads them off the CANONICAL manifest even when the prose comes from `course.en.yml`, so a translation cannot disagree about whether the course is done. `CatalogEntry` carries `build` and `translatedCount`; the catalog card, the landing's `CourseBuildNotice` and `SyllabusAccordion` (which renders EVERY manifest block, the unwritten ones as «próximamente» rows) all read them from there — don't re-derive a block count from `new Set(lessons.map(l => l.block))`, which counts the blocks that happen to have a lesson, not the blocks the course has.
- **The blog's areas and topics are closed lists** (`BLOG-13`). A post's frontmatter names one or two `areas` (the first is its card's label) and its `tags` (the topics), both validated against `src/constants/blog.ts` + the `BlogArea`/`BlogTopic` unions in `src/domain/types.ts`; each needs a label under `blog.areas.*` / `blog.topics.*` in both message files, and a new area also an icon (`ICON_NAMES` + `pnpm build:icons`) and a hue in `src/features/blog/blog-taxonomy.css`. The index (`BlogIndex`) filters and pages on the client with its state in the URL (`/blog?area=&topic=&page=`, logic in `blog-filter.ts`), inside a `<Suspense>` whose fallback is the unfiltered list so the prerendered HTML stays the full first page; the archive pane beside a post shares the reader's last filter through sessionStorage (`blog-filter-store.ts`). `cover:` is one of the post's own figures (`/blog/<slug>/…`, existence checked by `lint:content`).
- **Translation progress is the other axis, and it is per lesson, not per course.** Whether to show "in Spanish" copy is `fullyTranslated`, never `contentLocale === locale`: `contentLocale` is the FIRST lesson's language, so a course with only block 1 translated reads as fully translated. `translatedCount` / `getEnglishTranslationCoverage()` give the split that the card badge, `ContentLanguageNotice` and the landing FAQ's `dynamic: english-translation-status` all quote.
- Booking schedule (working hours, min advance notice, timezone, cancellation window) is NOT hardcoded. It lives in the Supabase `working_hours` + `booking_settings` tables (single source of truth), edited at `/admin/schedule`. The backend reads `ScheduleService.getConfig()`; the web reads it via the `ScheduleProvider` context inside `CommerceProviders` (30-day ISR loader `src/lib/schedule-config.ts`, tag-revalidated on an admin save); the mobile app reads `GET /api/schedule` (authenticated, working-hour blocks in minutes since midnight). `src/lib/booking-config.ts` now holds only pure helpers (`slotsFromBlocks`, `isWithinBlocks`, `gridHourRange`) + the static `BOOKING_WINDOW_WEEKS`.
- Account deletion (`ACCOUNT-DELETE-01`) is **gated and irreversible**. `GET /api/account` returns the eligibility verdict; `DELETE /api/account` performs it (body `{ confirmEmail }`, must equal the session email). Both accept the mobile bearer via `getSession()`. Deletion is refused with 409 while the user holds redeemable pack credits (`DELETION_BLOCKED_ACTIVE_PACK` → refund by email) or upcoming classes he can still cancel (`DELETION_BLOCKED_CANCELLABLE_BOOKINGS` → cancel them first); the ladder lives in `AccountService.getDeletionEligibility`. The purge itself is the `delete_user_account` stored procedure (migration `0017`, re-declared in `0021` and `0022`), which walks 16 tables in FK-safe order in one transaction — do NOT delete users application-side. Clients must discard their credential on a 200: the session cookie and the 1h bearer outlive the account and `ensureUser()` would recreate an empty row.
- Reader feedback on lessons and posts (`CONTENT-FEEDBACK-01`) is **anonymous-friendly by design**. The footer row (`src/features/content/ContentFeedback.tsx`, mounted by `LessonLayout` and the blog post page) does 👍/👎 + optional 👎 comment, share (native sheet on touch, clipboard elsewhere) and "report an error". Content is identified by `(content_type, content_key)` — `lesson` + `"<courseSlug>/<lessonSlug>"`, `post` + `"<slug>"` — plain TEXT, never an FK (helpers in `src/lib/content/content-key.ts`). Votes upsert on `(content_type, content_key, voter_key)` where `voter_key` is `user:<id>` or `anon:<localStorage uuid>`; the row mirrors the LAST submission. No IP is stored, no counts are public, and the page fetches nothing on mount (the reader's own vote lives in localStorage). `POST /api/content/{vote,report}` accept a null session and answer 200 for unknown content (dropped + logged, `CourseService` precedent). Reports mail `NOTIFY_EMAIL` and are triaged at `/admin/feedback`. Tables in migration `0021`; the `locale` column is the locale of the PROSE judged (`view.contentLocale`), not the URL prefix.
- The cancellation/reschedule window is admin-editable: `booking_settings.cancel_min_notice_hours` (migration `0019`, default 2), distinct from `min_notice_hours` (the *booking* advance-notice). It rides the same `ScheduleConfig` as the rest of the schedule. Read it via `BookingService.getCancelWindowMs()` (hours → ms) — the single source of truth the cancel guard, reschedule guard, and `AccountService`'s deletion-eligibility gate all share, so they can never disagree. Don't re-derive the window or reintroduce a `CANCEL_WINDOW_MS` constant.
- The home is **two routes** (`LANDING-01`). `/` and `/en` are the static marketing home and must stay static (SEO-01: Googlebot crawls cookieless and needs a 200). `src/middleware.ts` rewrites the home to `/[locale]/inicio` only when a NextAuth session cookie is *present* — presence, not validity, because `src/auth.ts` imports the Supabase services and cannot run on the Edge — **and** the request is a *landing*: `Sec-Fetch-Site` is not `same-origin` (typed URL, bookmark, link from another site, or no header). In-app navigation to `/` («Inicio», the logo, a reload once there, RSC fetches) is `same-origin` and gets the static home, so signed-in users can still read it. `/inicio` (never linked, robots-disallowed, redirects to `/` unless the middleware's `x-landing-rewrite` marker is set) runs `auth()` + `LandingService.resolve` — admin → `/admin`; anyone who has ever booked or holds pack credits → `/area-personal`; else the in-progress course with the newest activity (`CourseService.getCurrentCourse`) → `/cursos/<slug>`; else `/area-personal` — and redirects with next-intl's locale-aware `redirect`. A stale cookie renders the home in place (redirecting to `/` would loop). In-app links to `/` therefore need no special casing; `signOut({ callbackUrl: "/" })` clears the cookie and lands on the home either way.
- The booking shell is split in two (`src/features/booking/`): `BookingOverlays` (= `BookingProvider`, the booking brain — `useUserSession` + `useBookingRouter`, the window listeners, the `?book=` consumer — plus the `next/dynamic`-loaded booking screens: calendar, sign-in gate, wizard, pack booking) is mounted on `/`, `/mentoria` **and** `/area-personal`, once per page, so the CTAs open in place; `InteractiveShell` (the sessions/packs sections + chat FAB) is mounted on `/mentoria` only, inside a `Suspense` boundary, and is what mounts `RescheduleBridge` (the one `useSearchParams`). The personal area's CTAs call the router through `useBooking()` (`src/features/personal-area/useBookingActions.ts` — `openBooking(intent)` / `openReschedule(booking)`; `booking-intent.ts` mirrors the `?book=` switch) and `PersonalArea` reads `packSession` from that context (the same page-wide state its own `useUserSession()` would return since `REFACTOR-R4-P2-04`) — don't push the CTAs to `/mentoria?book=` again. Cross-page booking intents still travel as `/mentoria?book=<free15min|session1h|session2h|pack|pack5|pack10|smart|availability>` (today only the course reader's `LessonCta`) or `/mentoria?reschedule=<type>&token=…` (email links); OAuth restores use `/mentoria?intent=…` / `?action=…` — but only when the sign-in popup is blocked and `GoogleSignInButton` falls back to a full redirect: the normal popup sign-in never reloads the page, so `useBookingRouter` parks the signed-out intent in memory and resumes it in place on whichever page the gate opened (`SignInGate` passes `resumeInPlace`). Never link to `/?book=` (the provider would consume it, but nothing may rely on that).
- **A booking surface owns one history entry** (`BOOKING-EXIT-01`, `src/hooks/useBookingHistory.ts`). While any booking surface shows (wizard, pack screen, availability calendar, sign-in gate, pack purchase — `bookingSurfaceOpen` in `BookingProvider`, the same conditions `BookingOverlays` renders on; `PackBookingOverlay` on `/sesion/[token]` uses the hook too) there is exactly ONE same-URL history entry marked `__bookingOverlay`: browser/Android back closes the booking, a close from the UI pops the entry (`history.back()` from the effect body, never a cleanup — an unmount races Next's own push), and leaving for another page from inside it REPLACES the entry (`isBookingEntryOnTop()` → `router.replace`). Site links reach an open booking through the cancelable `close-booking-overlay` event (`requestBookingExit`, `src/lib/booking-exit.ts`, wired on every Navbar/Footer page link): the current page closes in place, another page is a replace. Never close the overlay AND navigate in the same handler. The exit control is `BookingExitButton` («Salir de la reserva»): in the wizard it sits left of the steps in `WizardProgress` (`onExit`), on the pack screen it is `BookingSidebar`'s `footer`, and `BookingLayout`'s own `onExit` bar is only for the wizard's success/error screens (`BOOKING-STEPS-01`). A single session's type is switched in the wizard's sidebar (`SessionTypePicker`), never by leaving it. The wizard's steps are clickable in order — `reachableWizardSteps` (`src/components/booking/wizard-steps.ts`): back to any finished step, forward only to the next one when it can be taken, so «Pago» is never reachable without passing «Revisión»; everything locks while a request or a payment confirmation is in flight.
- **The server decides what is bookable, in one place** (`REFACTOR-R4-P1-01`): `BookingService.checkSlot()` / `assertSlotBookable()` check the session length, the 15-minute grid in the tutor's timezone, min-notice, the booking window and the working blocks, in-process (no network call). `createBooking` runs it before any side effect, checkout before the PaymentIntent exists. Session lengths live in `SESSION_DURATION_MINUTES` (`src/lib/booking-config.ts`). Never trust a client `endIso`: the length check is what keeps a class from outgrowing what was paid for, and the webhook books `startIso + paid duration`, never the metadata `end_iso`. There is deliberately no Google Calendar or Stripe read on `/api/book` or at checkout (latency; the paid webhook keeps its freebusy re-check). A refund or dispute issued after booking is caught off the booking path by the daily `BookingPaymentAuditService`. The free 15-minute call is capped at one non-cancelled `free15min` per user (`IBookingRepository.hasActiveFreeSession`; cancelling frees it, a reschedule is exempt). Gustavo confirmed that policy (2026-10-01); changing it is that one guard in `createBooking`.
- **A failed reschedule leaves the student their class** (`REFACTOR-R4-P1-03`, `BookingService.createBooking`). Order: claim the original (consume its token, so the exclusion constraint admits an overlapping new slot) → create the new booking → tear the original down (calendar event, Zoom session, pending termination) only after the emails, when nothing can throw. Until then the claim's compensation is `IBookingRepository.reinstateBooking` (back to `confirmed` with its original tokens). A pack reschedule moves the original's credit (`credit_pack_id`) to the new booking (no restore + decrement); a paid one carries its `stripe_payment_id`. Don't move the teardown before a step that can throw.
- **Cancelling is one transaction** (`REFACTOR-R4-P1-04`): the `cancel_booking` RPC (migration `0023`) flips the status and restores a pack class's credit together — to the pack it was paid from (`bookings.credit_pack_id`) if still redeemable and not full, else the earliest-expiring active pack with room, else nothing (that fallback for an expired originating pack was confirmed by Gustavo on 2026-10-01; it is the `ELSE` branch of `cancel_booking`). `creditsRestored` is what the RPC reported, never inferred from the session type; when nothing was restored the API, `/cancelar` and the email say so, and `BookingService` logs an `error`. The booking saga's compensation restores to the exact pack it decremented (`restore_credit_to_pack`). Credit moves stay in stored procedures.
- **Repository reads that gate a side effect fail CLOSED** (`REFACTOR-R4-P1-02`): idempotency, "already fulfilled" and eligibility reads (`IPaymentRepository.isProcessed` / `hasFailedBooking` / `wasRefunded`, `IBookingRepository.hasBookingForPayment` / `listByUser` / `hasAnyBooking` / `findByStripePaymentId`, `ICreditsRepository.hasProcessedPayment`) throw on a Supabase `error`; `false` / `null` / `[]` means *known absent*. A read error that reads as "absent" refunds a paid class or erases an account; a throw makes the webhook answer 500 and Stripe redeliver. New gating reads follow the same contract.
- **Google Calendar goes through `@googleapis/calendar`** (`src/infrastructure/google/CalendarClient.ts`, `REFACTOR-R4-P2-01`). Never import `googleapis`: its full API catalog put a ~10 MB chunk into the trace of almost every API route. The package is pinned to 9.x, the last major on `google-auth-library@9`.
- **The icon font is a subset** (`REFACTOR-R4-P2-02`): the woff2 holds only the names in `src/constants/icons.ts` (`ICON_NAMES`). Adding an icon = add the name, run `pnpm build:icons`, commit the regenerated `src/app/[locale]/fonts/material-symbols-outlined.{woff2,json}`; `pnpm check:icons` (CI) fails otherwise. A name that only exists at runtime is invisible to the check, so add it by hand. A missing glyph renders as its ligature word (`calendar_month`), not an icon.
- **Prices, pack validity and the schedule reach the web through `CommerceProviders`** (`src/components/commerce/CommerceProviders.tsx`, `REFACTOR-R4-P2-03`), mounted per commerce page — `/` (and `/inicio`), `/mentoria`, `/area-personal`, `/sesion/[token]`, and the layouts of `/pago-exitoso` and `/sesion-confirmada` — **not** the root layout, so lessons and posts carry no `pricing-all` / `schedule-config` ISR tag and no build-time Supabase read. A new page that books or shows prices must mount it: `usePrices`, `useProductPrice`, `useSessionPriceLabel`, `usePackValidityDays` and `useScheduleConfig` throw outside it. The footer's policy modal (`src/features/landing/FooterModals.tsx`) is the one exception: it reads the `*Optional` hooks and falls back to a lazy fetch of the static `GET /api/policy`.
- **`useUserSession()` reads one page-wide state** (`src/hooks/useUserSession.ts`, `REFACTOR-R4-P2-04`): `UserSessionProvider` (root `[locale]/layout.tsx`, inside `AuthProvider`) mounts `useUserSessionState()` once, so a page makes one `/api/credits` request and the Navbar, the booking shell and the overlays share one credit count. Call `useUserSession()` anywhere; never mount the state a second time.
- **Stripe reconciliation lives in `PaymentService.reconcileRecentPayments`** (`REFACTOR-R4-P3-01`); `/api/internal/reconcile-stripe` only authenticates, logs and answers. A succeeded PaymentIntent counts as handled if it has a processed marker, a booking, a dead-letter entry or a slot-taken refund (`wasRefunded`): a refund is proof of handling, because it never writes the processed marker. Route handlers don't import the `stripe` singleton.
- **Every Stripe write carries an idempotency key** (`REFACTOR-R4-P4-01`, `PaymentService`): the slot-taken refund uses `refund:slot_taken:<pi>`, and the checkout keys include amount + currency, because an admin price edit inside the 5-minute dedup window would otherwise reuse a key with a different amount, which Stripe rejects.
- **Admin reads go through `AdminService` → `IAdminQueryRepository`** (`SupabaseAdminQueryRepository`, `REFACTOR-R4-P3-02`); admin pages and routes don't query Supabase directly. A "student" is a user with at least one booking or credit pack (the `admin_list_students` RPC, migration `0024`, which also searches, paginates and returns both tab counts), so course-only readers are not students. Credit adjustments are `AdminService.adjustCredits`: a debit stops at the real balance and reports `{ requested, applied }`.
- **A student's first booking records where they came from** (`BOOKING-ATTRIBUTION-01`). `AttributionCapture` (root layout) keeps the visit's FIRST attributed touch in localStorage for 90 days (UTM tags, else an external referrer's host; direct visits and Google-OAuth / Stripe hops never count) — `src/lib/attribution.ts`. `api-client` attaches it to `POST /api/book` and the single-session checkout; a paid class carries it in the PaymentIntent metadata (`utm_*`, `referrer_host`, `landing_path`) to the webhook. At the end of a successful, non-reschedule `createBooking`, `IUserRepository.recordFirstBooking` writes it ONCE to the users row — `first_booking_type`, `first_booked_at`, `utm_source` / `utm_medium` / `utm_campaign` / `referrer_host` / `landing_path` (migration `0025`, all nullable, backfilled `first_booking_*` for students who booked before it). Write-once is the `first_booked_at IS NULL` guard; later bookings never touch it, and a failure is logged, never fails the booking. A cookieless-bearer request (the mobile app) is labelled `utm_source = mobile_app`. The schema field is `.catch(undefined)`: bad attribution is dropped, never a reason to refuse a booking. New bookings also fire Vercel Analytics `intro_call_booked` / `class_booked` (`src/lib/booking-analytics.ts`); the table is the source of truth.

## Testing
- `pnpm test` — Jest unit + integration tests
- `pnpm test:unit` — unit tests only
- `pnpm test:integration` — integration tests only
- `pnpm test:e2e` — Playwright end-to-end tests
- Tests for services live in `src/services/__tests__/`
- Tests for infrastructure live alongside: `src/infrastructure/supabase/__tests__/`
- Integration tests in `src/__tests__/integration/`
- Test fixtures (fakes, in-memory repos) in `src/__tests__/fixtures/`
- New business logic requires a service-level test with mock repositories

## Commands
- `pnpm dev` — local dev server
- `pnpm build` — production build (must pass before PR)
- `pnpm lint` — must pass
- `pnpm test` — all Jest tests
- `pnpm test:e2e` — Playwright tests (requires `E2E_BASE_URL`)
- `pnpm check:icons` — the icon-font subset matches the icons `src/` uses (CI)
- `pnpm build:icons` — rebuild the icon-font subset from `src/constants/icons.ts`

## Database
- Schema defined in `supabase/migrations/`
- Never edit applied migrations — create new numbered files for changes
- Generated types in `src/infrastructure/supabase/types.ts` — regenerate after schema changes:
  `supabase gen types typescript --project-id <ref> > src/infrastructure/supabase/types.ts`

## Where Things Live (Quick Reference)

| I want to...                    | Look in                                         |
|---------------------------------|-------------------------------------------------|
| Add a domain type               | `src/domain/types.ts`                           |
| Add a domain error              | `src/domain/errors.ts`                          |
| Add a repository method         | `src/domain/repositories/I*Repository.ts` (interface) + `src/infrastructure/supabase/Supabase*Repository.ts` (impl) |
| Add business logic              | `src/services/*.ts`                             |
| Add an API route                | `src/app/api/`                                  |
| Add an admin feature            | `src/app/[locale]/admin/` + `src/app/api/admin/` |
| Change a session/pack price     | `/admin/pricing` (DB `pricing` table, public) or `/admin/students/<email>` (DB `user_pricing`, one student); merged in `PricingService.resolve()`; display via `src/lib/pricing-display.ts` + `PricesProvider` (inside `CommerceProviders`) |
| Add a Zod schema                | `src/lib/schemas.ts`                            |
| Change the booking schedule     | `/admin/schedule` (DB `working_hours` + `booking_settings`); helpers in `src/lib/booking-config.ts` |
| Is this slot bookable?          | `BookingService.checkSlot()`; session lengths in `SESSION_DURATION_MINUTES` (`src/lib/booking-config.ts`) |
| Add an icon                     | `src/constants/icons.ts`, then `pnpm build:icons` (`pnpm check:icons` in CI) |
| Admin read/query                | `src/services/AdminService.ts` → `src/domain/repositories/IAdminQueryRepository.ts` (impl `src/infrastructure/supabase/SupabaseAdminQueryRepository.ts`) |
| Add a blog area or topic        | `src/constants/blog.ts` + unions in `src/domain/types.ts` + `blog.areas.*` / `blog.topics.*` in both message files (areas: icon + hue in `blog-taxonomy.css`) |
| Say a course is (un)finished    | `lessons:` per block in `content/courses/<slug>/course.es.yml`; status via `src/lib/courses/course-build.ts` |
| Change email templates          | `src/infrastructure/resend/email-functions.ts`   |
| Add/change UI or email text     | `messages/es.json` **and** `messages/en.json` (keep keys in sync) |
| Add a DB column                 | New file in `supabase/migrations/`              |
| Add a rate limiter              | `src/lib/ratelimit.ts`                          |
| Fix a test fixture              | `src/__tests__/fixtures/`                       |
| Add a home section              | `src/features/home/`                            |
| Change the Mentoría page        | `src/features/mentoria/`                        |

## Code Quality Rules
- Only modify files relevant to the task at hand
- Do not refactor adjacent code "while you're there"
- Do not rename variables unless explicitly asked
- Preserve existing comments unless they're now incorrect
- Every fix that has a ticket or ID gets a comment block at the file top
  (e.g., `SEC-01`, `PERF-04`)

## Do Not
- Add `console.log` — use `log()` from `src/lib/logger.ts`
- Create new Redis clients — import `kv` from `@/infrastructure/redis/client`
- Store persistent data in Redis — use Supabase
- Put business logic in route handlers — it belongs in `src/services/`
- Edit applied migration files — create new ones
- Skip tests — every service change needs a test

## Refactor workflow

Refactors live in `docs/refactor/` while active, then move to
`docs/archive/refactor-YYYY-MM-DD/` when complete.

Structure of an active refactor:
- `PLAN.md` — master audit
- `STATUS.md` — living progress tracker
- `phase-N-name/README.md` — phase overview
- `phase-N-name/NN-task.md` — individual tasks

Conventions:
- Each task tagged `REFACTOR-PN-NN` in code comments (from cycle 3 on, the tag
  carries the cycle: `REFACTOR-R3-PN-NN`)
- Each task = one PR
- Each task md has: TL;DR, context with line refs, files affected,
  the change, acceptance criteria, test plan, gotchas, out of scope
- Update STATUS.md when starting, completing, or blocking a task
