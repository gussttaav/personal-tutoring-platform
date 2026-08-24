# P6-02 — Waitlist launch email

**Tag:** `COURSE-P6-02` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Announce the course to everyone who signed up via the ComingSoonModal — the rows in
`subscriptions` with `type = 'courses'`. They asked to be told; this is the whole reason that
table exists.

**Do this last.** It is the one genuinely irreversible action in the plan.

## Context

- `subscriptions` (`0002_subscriptions.sql`, refactored by `0003_user_fk_refactor.sql`) keys on
  **`user_id`, not `email`** — the email column was dropped. Unique `(user_id, type)`.
  `ISubscriptionRepository` currently exposes only `subscribe` and `isSubscribed`; listing
  subscribers is a new method.
- **Every subscriber has a `users` row.** `POST /api/subscribe` requires a session (401 otherwise)
  and `SubscriptionService.subscribe` calls `userService.ensureUser(email)` before inserting.
  Both `email` and `locale` therefore come from the `users` join — there is no
  "subscriber without a user" case to handle.
- Email goes through Resend (`src/infrastructure/resend/email-functions.ts`); templates are
  bilingual.
- **`users.locale` is the source of truth for background sends** — the `NEXT_LOCALE` cookie drives
  rendering, but there is no request context here. Same rule the Stripe-webhook booking emails follow.
  `locale` may still be NULL for a user who never triggered `seedLocaleOnLogin`; default to Spanish.
- Vercel Hobby: no cron. This is a **manually triggered** one-off.

## Files affected

| File | Change |
|------|--------|
| `src/domain/repositories/ISubscriptionRepository.ts` | + `listByType(type): Promise<{ userId, email, locale }[]>` |
| `src/infrastructure/supabase/SupabaseSubscriptionRepository.ts` | Implement — inner join `users` for `email` + `locale` |
| `src/infrastructure/resend/email-functions.ts` | + `sendCourseLaunchEmail` |
| `messages/es.json` + `messages/en.json` | + `emails.courseLaunch.*` (**both files**) |
| `src/app/api/admin/course-announce/route.ts` (new) | Admin-gated trigger, dry-run by default |
| `src/__tests__/fixtures/` | Extend the in-memory subscription fake |

## The change

**Trigger:** an admin-only route (`isAdmin()` + `isValidOrigin()`), **dry-run by default**.
`POST` with no body returns the recipient count and a sample rendered email without sending.
Sending requires an explicit `{ confirm: true }`. That asymmetry is deliberate: the accidental
call should be the harmless one.

**Batching + rate.** Send in batches with a delay between them, well under Resend's rate limit,
and keep total execution under the 25s function cap. If the list has grown large enough that one
invocation can't finish, process in chunks with an offset parameter and call it repeatedly rather
than reaching for a queue — this runs once, ever.

**Idempotency.** Record what was sent so a retry after a partial failure doesn't double-send.
Simplest sufficient approach: write an `audit_log` entry per successful send and skip addresses
already recorded. Do not add a table for a one-off.

**Content:** what the course is, who it's for, that it's free, prerequisites, a direct link to the
free sample lesson (not just the landing page — let them *see* it), and an honest note that it's
Spanish-only for now with English planned. Localise per `users.locale`, defaulting to Spanish.

**Unsubscribe.** Check what the existing subscription emails do and match it. If there is no
unsubscribe mechanism today, add at minimum a plain-text "responde a este correo para no recibir
más" — a bulk send with no opt-out is both bad practice and a deliverability risk.

## Acceptance criteria

- [ ] Dry run reports the recipient count and renders a sample without sending anything
- [ ] Sending requires explicit confirmation
- [ ] Route is admin-gated (`isAdmin()`) and CSRF-protected (`isValidOrigin()`)
- [ ] Emails localise per `users.locale`; a NULL locale falls back to Spanish
- [ ] Both locale templates exist and render (keys in **both** message files)
- [ ] Links point at production URLs and are verified live **before** sending
- [ ] Partial failure is retryable without double-sending
- [ ] A per-send failure is logged and does not abort the batch
- [ ] Execution stays under 25s (or chunks cleanly)
- [ ] An unsubscribe path exists
- [ ] `pnpm test` + `pnpm build` green

## Test plan

- **Service/route unit:** non-admin → 403; missing confirm → dry-run, zero sends; send path calls
  the email client once per recipient; a throwing send doesn't abort the batch; already-recorded
  recipients are skipped.
- **Repository unit:** `listByType` returns only `courses` rows; `email`/`locale` resolve via the
  `users` join; NULL locale defaults to `es`.
- **Manual (mandatory before the real send):** send to a small internal list first. Check
  rendering in Gmail web, Gmail mobile and Apple Mail; click every link; verify both locales;
  check it doesn't land in spam.
- **Then** run for real, and only after P6-03 has made the URLs live.

## Notes / gotchas

- **Verify every link against production before sending.** An email is not editable after it goes
  out. This is the single highest-consequence step in the plan.
- Send to yourself in both locales first. Always.
- `users.locale` is the correct source here, not a cookie — there is no request context in a
  background send. Same rule as the booking emails.
- Some subscribers signed up months ago and may not remember. Open with one line of context.
- Because subscribing requires sign-in, every recipient already has a Google account on the site —
  the email can link straight to a lesson and progress tracking will just work.
- Don't send at a weekend or late at night in the audience's timezone.
- Don't build a newsletter system. This is one email, one time.

## Out of scope

- Drip campaigns, per-lesson notifications, re-engagement emails.
- A general newsletter or subscriber management UI.
- Blog subscribers (`type = 'blog'`) — untouched.
