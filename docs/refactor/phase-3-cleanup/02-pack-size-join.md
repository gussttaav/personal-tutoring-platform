# P3-02 — Pack size by join, not per row

**Tag:** `REFACTOR-R5-P3-02` · **Severity:** 🟢 · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

`SupabaseBookingRepository.listByUser` maps every confirmed booking through `getPackSize`, which
is one `credit_packs` query per row (parallel, so it's round trips rather than latency, but N of
them). `findByCancelToken` does one more. `getPackSize` also discards the PostgREST `error`: a read
failure reads as "no pack size", which the reschedule then carries as `packSize: undefined` onto
the new booking's token payload. Embed the pack size in the main select through the existing FK
(`bookings.credit_pack_id → credit_packs.id`), and delete the helper. *(Deferred from R4.)*

## Context

- `src/infrastructure/supabase/SupabaseBookingRepository.ts:718-728`: `getPackSize`, `const { data } = …` (error ignored).
- `:112`: `findByCancelToken` calls it after verifying the HMAC.
- `:233-258`: `listByUser` selects `credit_pack_id` and then `Promise.all(rows.map(… getPackSize …))`.
- `supabase/migrations/0001_complete_schema.sql:52`: `credit_pack_id UUID REFERENCES credit_packs(id)`, so PostgREST can embed it.
- Callers that care about `packSize`: `BookingService.createBooking:291-295` (pack reschedule), `listForUser` → `/api/my-bookings` and the personal area (pack badge), `AccountService` (eligibility uses `listByUser`; it's fail-closed since R4-P1-02).

## Files affected

| File | Change |
|------|--------|
| `src/infrastructure/supabase/SupabaseBookingRepository.ts` | Embed `credit_packs(pack_size)` in the two selects; delete `getPackSize` |
| `src/infrastructure/supabase/__tests__/SupabaseBookingRepository.test.ts` | DB-gated: pack booking's `packSize` still present in both reads |
| `src/infrastructure/supabase/__tests__/fail-closed.test.ts` | If the mocked builder covers `listByUser`, it now needs only the two calls |

## The change

```ts
// REFACTOR-R5-P3-02: pack size embedded via the credit_pack_id FK — was one query per row
// (and its error was ignored, so a blip read as "no pack").
const { data, error } = await supabase
  .from("bookings")
  .select("calendar_event_id, session_type, starts_at, ends_at, cancel_token, join_token, credit_pack_id, credit_packs(pack_size)")
  .eq("user_id", user.id)
  .eq("status", "confirmed")
  .order("starts_at", { ascending: true });
if (error) throw error;

// row.credit_packs is an object (many-to-one) or null
const packSize = (row.credit_packs as { pack_size: number } | null)?.pack_size ?? undefined;
```

Same for `findByCancelToken`'s booking select. Regenerated `types.ts` already knows the relationship.
If the embed's inferred type is awkward, narrow it with one local type, not `any`.

## Acceptance criteria

- [ ] `listByUser` issues 2 queries (user, bookings) for any number of bookings
- [ ] `findByCancelToken` issues 2 queries (booking, user)
- [ ] A pack booking still returns `packSize`; a non-pack booking returns `undefined`
- [ ] No `getPackSize` remains
- [ ] File-top block carries `REFACTOR-R5-P3-02`

## Test plan

- **Existing:** DB-gated `SupabaseBookingRepository.test.ts`, `fail-closed.test.ts`, `reschedule.test.ts` (pack reschedule carries `packSize`), `BookingService.test.ts`.
- **New (DB-gated):** user with two pack bookings from different packs (5 and 10) → `listByUser` returns `packSize` 5 and 10.
- **New (unit, mocked client):** count `from()` calls in `listByUser` with three rows → 2.

## Notes / gotchas

- PostgREST embeds by FK name. There's one FK from `bookings` to `credit_packs`, so `credit_packs(pack_size)` is unambiguous. If a second FK is ever added, it needs the `!fk_name` hint.
- RLS doesn't matter here: the server uses the service-role client.

## Out of scope

- `listHistoryByUser`, which already batches pack/payment lookups (`booking-history.ts`).
