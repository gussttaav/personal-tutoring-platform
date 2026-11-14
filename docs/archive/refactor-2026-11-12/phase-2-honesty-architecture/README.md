# Phase 2 — Honesty & Architecture

Two kinds of work. P2-02 makes what the student reads (the cancellation email and the booking
history) match what the database did. P2-01 and P2-03 move logic that grew inside route handlers
back into services, as CLAUDE.md requires ("Route handlers are thin dispatchers").

- **P2-01 (🟡):** `/api/chat` does a private-price merge (two `user_pricing` reads per turn),
  assembles the system prompt and tool context, and owns the Redis kill switch. It's the only route
  that imports `kv`.
- **P2-02 (🟡):** a pack class cancelled with no credit restored still gets the email's
  individual-payment refund line, and history reads «crédito devuelto». A rescheduled original also
  reads «crédito devuelto» (pack), or repeats the price (paid). The database never records why a
  booking became `cancelled`. *(Deferred from R4, two items.)*
- **P2-03 (🟢):** the session-cleanup cron's batch/attempt loop lives in the route, which imports
  `supabaseBookingRepository` directly. The same shape `REFACTOR-R4-P3-01` fixed for the reconcile cron.

**Order:** P2-02 after Phase 1, because it edits the reschedule claim P1-01 and P1-03 touch. P2-01
and P2-03 are independent and can land any time, including in parallel with Phase 1.

## Tasks

1. [01-chat-route-to-service.md](01-chat-route-to-service.md): `REFACTOR-R5-P2-01` (🟡, M)
2. [02-cancel-reschedule-honesty.md](02-cancel-reschedule-honesty.md): `REFACTOR-R5-P2-02` (🟡, M)
3. [03-session-cleanup-to-service.md](03-session-cleanup-to-service.md): `REFACTOR-R5-P2-03` (🟢, S)

## Exit criteria

- [ ] `src/app/api/chat/route.ts` imports neither `kv` nor `userService` / `pricingService`; `src/app/api/chat/__tests__/route.test.ts` passes with only its mocks updated
- [ ] One `user_pricing` read per chat turn for a student with overrides (today: two)
- [ ] Cancelled pack class, nothing restored → email line «no se ha podido devolver el crédito…», history «crédito no devuelto»
- [ ] Rescheduled originals: pack → «crédito pasado a la nueva clase»; paid → no amount on the original, the price once on the new row
- [ ] Legacy rows (before `0030`) keep today's labels
- [ ] `src/app/api/internal/session-cleanup/route.ts` imports nothing from `@/infrastructure`; same JSON response
- [ ] `0030` applied to the test DB, `types.ts` regenerated; `pnpm check:messages`, `pnpm test`, `pnpm lint`, `pnpm build` green

## Relation to prior cycles

P2-02 extends `REFACTOR-R4-P1-04` (the `cancel_booking` RPC's `restored` answer is now persisted)
and `REFACTOR-R4-P1-03` (the reschedule claim marks its original). P2-03 mirrors
`REFACTOR-R4-P3-01`. P2-01 keeps `CHAT-AGENT-P1-02`'s rule that identity comes from the server
session, never from the model or the body.
