# P6-02 — Course notifications

**Tag:** `COURSE-P6-02` · **Effort:** M · **Owner:** _tbd_ · **Status:** ✅

## TL;DR

Was: "email the waitlist". **`subscriptions` is empty in production** — nobody ever signed up
through the ComingSoonModal — so there is no waitlist to email, and the modal that collected
them is being retired by P6-03 anyway.

Rewritten as what is actually worth having: a **"notify me about new courses"** opt-in that
lives under real content instead of behind a dead-end modal, and the **admin-triggered send**
that makes that promise deliverable. Nothing is sent as part of this task. The mechanism ships
dry, so the first announcement is not written under launch pressure.

## Context

- `subscriptions` (`0002_subscriptions.sql`, refactored by `0003_user_fk_refactor.sql`) keys on
  **`user_id`, not `email`** — the email column was dropped. Unique `(user_id, type)`, and a
  `CHECK (type IN ('courses','blog'))` that survived the refactor.
- **`type = 'courses'` is reused as-is; no migration.** One subscription means "new courses and
  major updates". There is deliberately no separate "tell me when English lands" flag: sends
  resolve language from `users.locale`, so an English subscriber already IS the audience for
  that announcement. A second type would be a schema change and a second checkbox for a list
  that is currently empty.
- **Every subscriber has a `users` row.** `POST /api/subscribe` requires a session (401
  otherwise) and `SubscriptionService.subscribe` calls `userService.ensureUser(email)` before
  inserting. Both `email` and `locale` come from the `users` join — there is no
  "subscriber without a user" case.
- **`users.locale` is the source of truth for background sends** — the `NEXT_LOCALE` cookie
  drives rendering, but a bulk send has no request context. Same rule the Stripe-webhook
  booking emails follow. NULL `locale` defaults to Spanish.
- Vercel Hobby: no cron. The send is **manually triggered**.

## Files affected

| File | Change |
|------|--------|
| `src/hooks/useSubscription.ts` (new) | The subscribe state machine, lifted out of `ComingSoonModal` |
| `src/features/courses/CourseNotifyCard.tsx` (new) | The opt-in, on `/cursos` and in the English language notice |
| `src/app/api/subscribe/route.ts` | + `DELETE` — the toggle, and the unsubscribe path |
| `src/services/SubscriptionService.ts` | + `unsubscribe`, `listSubscribers` |
| `src/domain/repositories/ISubscriptionRepository.ts` | + `unsubscribe`, `listByType` |
| `src/infrastructure/supabase/SupabaseSubscriptionRepository.ts` | Implement both — `listByType` inner-joins `users` for email + locale |
| `src/domain/repositories/IAuditRepository.ts` | + `listNotifiedEmails(action, key)` |
| `src/infrastructure/supabase/SupabaseAuditRepository.ts` | Implement — `.eq(action)` + JSONB `.contains({ announcementKey })` |
| `src/infrastructure/resend/email-functions.ts` | + `renderCourseNewsEmail` / `sendCourseNewsEmail` |
| `src/lib/schemas.ts` | + `CourseAnnounceSchema` |
| `messages/es.json` + `messages/en.json` | + `courses.notify.*`, `emails.courseLaunch.*` / `courseEnglish.*` / `courseUpdate.*` (**both**) |
| `src/app/api/admin/course-announce/route.ts` (new) | Admin-gated trigger, dry-run by default |
| `src/__tests__/fixtures/` | Extend the in-memory subscription + audit fakes |

## The change

**The opt-in.** `CourseNotifyCard` at the bottom of `/cursos` in both locales, and inside the
English landing's `ContentLanguageNotice` — the point at which an English visitor learns the
lessons are in Spanish is the honest place to offer "I'll tell you when they aren't". It is a
**toggle**, not a one-way button: subscribe, unsubscribe, and it reflects existing state on
load. That toggle IS the unsubscribe mechanism, which is why no token infrastructure is needed —
subscribing already required a signed-in account.

`useSubscription` is the modal's own logic extracted, not a rewrite; `ComingSoonModal` now
consumes it too, so there is one implementation rather than two that drift.

**The trigger:** an admin-only route (`isAdmin()` + `isValidOrigin()`), **dry-run by default**.
`POST` with no `confirm: true` returns the recipient count, the per-locale split, and the fully
rendered email in both locales, without touching Resend. That asymmetry is deliberate: the
accidental call should be the harmless one.

**Batching + rate.** 5 per batch, 1.2s between batches, default 30 recipients per invocation —
about 20s, inside the 25s Hobby cap with room to spare. Longer lists are walked with `offset`,
not by raising the batch size.

**Idempotency.** An `audit_log` row per successful send
(`action: "course_announcement_sent"`, `details.announcementKey`), and
`listNotifiedEmails` skips what is already recorded — one query, not one per recipient. Recorded
**after** the send, so a crash between the two re-sends rather than silently skipping. A partial
run is re-invoked, not restarted. No new table for something that runs a handful of times.

**`announcementKey`** defaults to `launch:<courseSlug>` and is overridable, so a *second*
announcement about the same course (the English translation landing, say) is not suppressed by
the first one's audit rows.

**Content:** what the course is, that it is free, nothing to install, a direct link to the first
lesson (not just the landing page — let them *see* it), and the landing page as a secondary
link. The English copy carries the Spanish-lessons caveat; that is a per-locale message value,
not a conditional in the template.

## Acceptance criteria

- [x] Opt-in reachable on `/cursos` in both locales and on the English landing
- [x] It is a toggle — subscribe and unsubscribe both work, and state survives a reload
- [x] Dry run reports the recipient count and renders a sample without sending anything
- [x] Sending requires explicit confirmation
- [x] Route is admin-gated (`isAdmin()`) and CSRF-protected (`isValidOrigin()`)
- [x] Emails localise per `users.locale`; a NULL locale falls back to Spanish
- [x] Both locale templates exist and render (keys in **both** message files)
- [x] Partial failure is retryable without double-sending
- [x] A per-send failure is logged and does not abort the batch
- [x] Execution stays under 25s (or chunks cleanly via `offset`)
- [x] An unsubscribe path exists
- [x] `pnpm test` + `pnpm build` green

## Test plan

- **Route unit** (`src/app/api/admin/course-announce/__tests__/route.test.ts`): signed out → 401;
  non-admin → 403; cross-origin → 403; unknown course → 404; missing `confirm` → dry run with
  zero sends; send path calls the email client once per recipient in that recipient's locale; a
  throwing send does not abort the batch and is not recorded; already-recorded addresses are
  skipped; `offset`/`limit` chunk and report `nextOffset`; a custom `announcementKey` is not
  suppressed by the previous one.
- **Service unit:** `unsubscribe` resolves the user then delegates; unsubscribing a non-existent
  user is a no-op that never calls `ensureUser`; `listSubscribers` passes the type through.
- **Before any real send (mandatory):** dry-run as admin and read BOTH rendered locales; send to
  yourself in both; check rendering in Gmail web, Gmail mobile and Apple Mail; click every link;
  check it doesn't land in spam.

## Notes / gotchas

- **Verify every link against production before sending.** An email is not editable after it
  goes out. This is the single highest-consequence action in the plan.
- `users.locale` is the correct source here, not a cookie — there is no request context in a
  background send. Same rule as the booking emails.
- Because subscribing requires sign-in, every recipient already has a Google account on the site —
  the email can link straight to a lesson and progress tracking will just work.
- Don't send at a weekend or late at night in the audience's timezone.
- Don't build a newsletter system. There is no free-text composition on purpose.

## COURSE-P6-02b — the two follow-ups, now built

Both items previously listed here as "decided, not yet implemented" have shipped.

**Three announcement kinds.** `kind` is a required field on `CourseAnnounceSchema`
(`launch` | `english` | `update`), each mapped to its own bilingual namespace by
`ANNOUNCEMENT_NAMESPACE` in `email-functions.ts` — `emails.courseLaunch`, `emails.courseEnglish`,
`emails.courseUpdate`. `update` carries one admin-typed "what's new" line, escaped with
`escapeHtml` and rendered in the template's existing `.note-box`; there is still no free-form
body. `english` pins its links to the `/en` tree regardless of the recipient's locale, because
the body is written in the reader's language but the thing being announced is the English course.

`kind` has **no default**: a POST that does not say which announcement it is gets a 400. Same
instinct as `confirm` being optional — the accidental call should be the harmless one.

**The `update` key.** `launch:<slug>` and `english:<slug>` are once-ever. `update` defaults to
`update:<slug>:<yyyy-mm-dd>` and the panel shows the resolved key with a warning, because reusing
a previous key means `listNotifiedEmails` skips everyone who received it — a silent no-op.

**Admin panel UI.** `/admin/course-announce` (`CourseAnnounceForm`). Type selector → mandatory
dry run, which renders both locale samples in a permission-less `<iframe sandbox="">` → type
`ENVIAR` → send. Editing any field discards the preview and re-locks the button, and the confirm
word re-arms for every chunk. The UI never attaches `confirm: true` to a body a dry run has not
already returned.

**Chunking, corrected.** The obvious continuation — re-POST with the `nextOffset` the response
hands back — is wrong. `offset` indexes into `pending`, which is the subscriber list *after*
already-notified addresses are filtered out, and a confirmed chunk records everyone it reached.
So `pending` shrinks between calls, and resuming at `nextOffset` steps clean over the people the
previous chunk just removed. The panel re-POSTs with **`offset: 0`** and lets the audit log do
the paging; `remaining` stays accurate across the walk. `offset` survives for its one remaining
use — stepping past an address that fails every time and would otherwise block the head of the
queue. Pinned by the two tests in `describe("chunked walk")`.

**Parity guard.** `src/__tests__/i18n-parity.test.ts` now fails the build on a key present in
only one message file — previously nothing caught that, and for an email template the first
symptom would have been an already-sent email.

## Out of scope

- **Actually sending anything.** Zero subscribers at launch; the route ships dry.
- Drip campaigns, per-lesson notifications, re-engagement emails.
- A general newsletter or subscriber-management UI.
- Per-course or per-language subscription types.
- Blog subscribers (`type = 'blog'`) — untouched.
