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
| `messages/es.json` + `messages/en.json` | + `courses.notify.*`, `emails.courseNews.*` (**both**) |
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

## Known follow-ups (deliberately not built here)

- **The opt-in promises more than the send delivers.** The notify card says "new courses OR a
  major update, including the English translation," but there is exactly ONE email template and
  it is launch-specific ("the course is published, here is what it is"). The *targeting* is
  generic — arbitrary `announcementKey`, per-`users.locale` resolution, idempotency, chunking —
  but the *content* only supports a launch. An "English version available" or "course updated"
  announcement is therefore NOT deliverable today without new template copy.
  **Decided approach (not yet implemented):** add a small fixed set of announcement *kinds*
  (`launch` / `english` / `update`), each with its own bilingual namespace, the `update` kind
  taking one admin-typed "what's new" line. Keeps it non-newsletter (no free-form body).
  Idempotency caveat: `launch`/`english` are one-shot keys, but each `update` must use a key
  unique per update (e.g. `update:<slug>:<date>`) or the audit-log de-dupe will suppress it.
- **Admin panel UI.** Sending today means hitting `POST /api/admin/course-announce` directly
  (dry run, then `confirm: true`). A panel page with type selector + preview + confirm is a
  planned follow-up; the route is ready for it.

## Out of scope

- **Actually sending anything.** Zero subscribers at launch; the route ships dry.
- Drip campaigns, per-lesson notifications, re-engagement emails.
- A general newsletter or subscriber-management UI.
- Per-course or per-language subscription types.
- Blog subscribers (`type = 'blog'`) — untouched.
