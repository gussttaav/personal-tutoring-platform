# P3-02 — Admin students area: reads behind a repository, writes hardened

**Tag:** `REFACTOR-R4-P3-02` · **Severity:** 🟡 · **Effort:** L · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

`/admin/students` is the only entry point to a student's credit adjustments and, since
`PRICING-STUDENT-01`, their private prices. Four problems:

**Part A: reads**
1. **Silently capped at 100 users.** The list is `users ORDER BY email LIMIT 100`, and search runs in
   the browser over those 100. Since the courses launched, every Google sign-in creates a `users` row,
   so real students past #100 alphabetically can't be found at all.
2. **The dashboard's "low credits" count is meaningless.** It's `total users − users with > 1 credit`,
   so every course reader who never bought anything counts as a student running low.
3. **The reads bypass the architecture.** `src/app/[locale]/admin/_data.ts` queries Supabase directly
   from `app/`, and three API routes import it from `@/app/[locale]/admin/_data`.

**Part B: writes**
4. **Two admin POSTs skip CSRF, and one holds business logic.** `POST /api/admin/students/[email]`
   (credit adjust) and `POST /api/admin/failed-bookings` (dead-letter retry) don't call
   `isValidOrigin`. The credit adjust loops `useCredit` in the route, swallowing errors, so "−3" on a
   student with 1 credit answers `{ ok: true }`.

One task, two parts. If the diff grows past comfortable review, land Part B first as its own PR
under the same tag and note it in STATUS.md.

## Context

**Part A**
- `src/app/[locale]/admin/_data.ts:76-85`: `fetchStudents` does `.from("users").select(…).order("email").limit(100)`.
- `src/app/[locale]/admin/students/page.tsx:26-28`: the comment says "Fetch the **full** list; filter + search are applied client-side". The UI subtitle knows better: `StudentsTable.tsx:45` "de hasta 100 alumnos".
- `src/components/admin/StudentsTable.tsx:21-37`: client-side `query` + `low-credit` filter over the fetched rows.
- `_data.ts:24-47` (`countStudentsWithLowCredits`): `totalUsers − healthyUsers`, with `healthy` meaning > 1 active credit. Used by `src/app/[locale]/admin/page.tsx:12,28`.
- Importers of `_data.ts`:
  - pages: `admin/{page,bookings/page,students/page,students/[email]/page,payments/page}.tsx`
  - API routes: `api/admin/{bookings,students,payments}/route.ts:11` and `api/admin/students/[email]/route.ts:15-20`

**Part B**
- `src/app/api/admin/students/[email]/route.ts:53-102`: POST with no `isValidOrigin`.
  - `:73-85` computes the manual pack's expiry in the route
  - `:86-90` `for (…) await creditService.useCredit(email).catch(() => { /* ignore if 0 */ })`
  - `:93-98` writes audit via `supabaseAuditRepository` directly
- `src/app/api/admin/failed-bookings/route.ts:32-44`: POST with no `isValidOrigin`.
- CLAUDE.md: "CSRF protection via `isValidOrigin()` on all POST routes (except Stripe webhook)".
- Admin threat model (memory, and cycle 3's `REFACTOR-R3-P2-01` won't-do): single admin, no role
  management. The CSRF fix is convention and defence in depth (SameSite=Lax already blocks the
  cookie cross-site), not a live exploit.

## Files affected

| File | Change |
|------|--------|
| `supabase/migrations/0024_admin_students.sql` (new) | `admin_list_students(p_query, p_low_credit, p_limit, p_offset)`; REVOKE/GRANT per `0018` |
| `src/domain/repositories/IAdminQueryRepository.ts` (new) | Read-only admin queries (dashboard counts, students page, student detail, bookings, payments, revenue) |
| `src/infrastructure/supabase/SupabaseAdminQueryRepository.ts` (new) + `index.ts` | Implementation; absorbs `_data.ts` |
| `src/services/AdminService.ts` (new) + `src/services/index.ts` | Thin read facade + `adjustCredits` orchestration |
| `src/app/[locale]/admin/_data.ts` | **Deleted** |
| `src/app/[locale]/admin/**/page.tsx`, `src/app/api/admin/{bookings,students,payments,students/[email]}/route.ts` | Call `adminService` |
| `src/components/admin/StudentsTable.tsx` | Server-side search (`?q=`) + pagination (`?page=`); tab counts from the query |
| `src/app/api/admin/students/[email]/route.ts`, `src/app/api/admin/failed-bookings/route.ts` | `isValidOrigin` first |
| `src/components/admin/AdjustCreditsForm.tsx` | Show "applied N of M" when a debit was partial |
| `src/infrastructure/supabase/types.ts` | Regenerate |
| `src/services/__tests__/AdminService.test.ts` (new), fixture `InMemoryAdminQueryRepository.ts` (new) | See Test plan |

## The change

### Part A: who is a student, and the list query

A **student** is a user with at least one booking or one credit pack. Course readers who never
booked or bought are excluded from the list and the metric. Still reachable by URL
(`/admin/students/<email>`).

```sql
-- 0024_admin_students.sql
-- REFACTOR-R4-P3-02: the admin students list, server-side. Replaces a users-first
-- `LIMIT 100` that hid every student past #100 by email once course sign-ins grew the table.
CREATE OR REPLACE FUNCTION admin_list_students(
  p_query TEXT, p_low_credit BOOLEAN, p_limit INT, p_offset INT
) RETURNS TABLE (
  email TEXT, name TEXT, total_credits INT, earliest_expiry TIMESTAMPTZ,
  next_session TIMESTAMPTZ, total_count BIGINT, low_credit_count BIGINT
) AS $$
  WITH students AS (
    SELECT u.id, u.email, u.name
    FROM users u
    WHERE (EXISTS (SELECT 1 FROM bookings b     WHERE b.user_id = u.id)
        OR EXISTS (SELECT 1 FROM credit_packs c WHERE c.user_id = u.id))
      AND (p_query IS NULL OR u.email ILIKE '%' || p_query || '%' OR u.name ILIKE '%' || p_query || '%')
  ), enriched AS (
    SELECT s.email, COALESCE(s.name, s.email) AS name,
           COALESCE((SELECT SUM(c.credits_remaining) FROM credit_packs c
                     WHERE c.user_id = s.id AND c.expires_at > now()), 0)::INT       AS total_credits,
           (SELECT MIN(c.expires_at) FROM credit_packs c
             WHERE c.user_id = s.id AND c.expires_at > now() AND c.credits_remaining > 0) AS earliest_expiry,
           (SELECT MIN(b.starts_at) FROM bookings b
             WHERE b.user_id = s.id AND b.status = 'confirmed' AND b.starts_at > now()) AS next_session
    FROM students s
  )
  SELECT e.*, COUNT(*) OVER () AS total_count,
         COUNT(*) FILTER (WHERE e.total_credits <= 1) OVER () AS low_credit_count
  FROM enriched e
  WHERE NOT p_low_credit OR e.total_credits <= 1
  ORDER BY e.email
  LIMIT p_limit OFFSET p_offset;
$$ LANGUAGE sql STABLE;
-- + REVOKE ALL … FROM PUBLIC / anon, authenticated; GRANT EXECUTE … TO service_role (0018 pattern)
```

Note: with `p_low_credit = true`, `low_credit_count` and `total_count` are computed after the filter.
Either call the RPC twice for the tab counts, or compute both counts in a CTE before the `WHERE`.
Pick one and test it.

Repository + service (sketch):

```ts
// IAdminQueryRepository — read-only, admin surfaces only
listStudents(opts: { query?: string; lowCredit: boolean; limit: number; offset: number }):
  Promise<{ rows: StudentSummary[]; total: number; lowCreditTotal: number }>;
dashboardCounts(): Promise<{ upcomingBookings: number; lowCreditStudents: number; failedBookings: number }>;
sumRevenueSince(sinceIso: string): Promise<number>;
getStudent(email: string): Promise<StudentDetail | null>;
listCreditPacks(email: string): Promise<CreditPackRow[]>;
listStudentBookings(email: string): Promise<BookingRow[]>;
listAllBookings(limit: number): Promise<AdminBookingRow[]>;
listPayments(limit: number): Promise<AdminPaymentRow[]>;
```

The types (`StudentSummary`, `StudentDetail`, `CreditPackRow`, `BookingRow`, `AdminBookingRow`,
`AdminPaymentRow`) move from `_data.ts` to `src/domain/types.ts`. `fetchAuditLog` already delegates
to `supabaseAuditRepository`. Route it through `AdminService`.

`StudentsTable` becomes URL-driven: the search input submits a GET form (`?q=`), tabs keep `?filter=`,
and pagination uses `?page=`. The page passes `{ rows, total, lowCreditTotal, page, pageSize: 50 }`.
The subtitle loses "de hasta 100 alumnos".

### Part B: writes

```ts
// both admin POST routes — first line of the handler
// REFACTOR-R4-P3-02: CSRF convention (CLAUDE.md) — every POST route checks origin.
if (!isValidOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

```ts
// AdminService
// REFACTOR-R4-P3-02: moved out of POST /api/admin/students/[email]. A debit stops at the
// student's real balance and says so, instead of swallowing InsufficientCreditsError.
async adjustCredits(params: { email: string; amount: number; reason: string; by: string }):
  Promise<{ requested: number; applied: number }> {
  const { email, amount, reason, by } = params;
  let applied = 0;
  if (amount > 0) {
    const days      = await this.pricing.getPackValidityDays();
    const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
    await this.credits.addCredits({
      email, name: "", amount, packLabel: `Ajuste manual: ${reason}`,
      stripeSessionId: `manual-${crypto.randomUUID()}`, expiresAt,
    });
    applied = amount;
  } else {
    for (let i = 0; i < -amount; i++) {
      try { await this.credits.useCredit(email); applied--; }
      catch (err) { if (err instanceof InsufficientCreditsError) break; throw err; }
    }
  }
  await this.audit.append(email, { action: "admin_adjust", amount, applied, reason, by });
  return { requested: amount, applied };
}
```

The route returns `{ ok: true, requested, applied }`. `AdjustCreditsForm` shows
"Aplicado: −1 de −3 (saldo insuficiente)" when they differ. The admin panel stays Spanish.

## Acceptance criteria

- [ ] A student whose email sorts after the first 100 users is found via the search box and listed on the right page
- [ ] Users with no booking and no credit pack are absent from the list and from the low-credit count; still reachable at `/admin/students/<email>`
- [ ] Low-credit tab count equals the number of **students** with ≤ 1 active credit
- [ ] `src/app/[locale]/admin/_data.ts` no longer exists; `grep -rn "admin/_data" src` → nothing; no file under `src/app` imports `@/infrastructure/supabase/client`
- [ ] Both admin POSTs return 403 for a cross-site origin (unit test with a mocked `NextRequest`)
- [ ] `−3` on a 1-credit student → balance 0, response `{ requested: -3, applied: -1 }`, audit entry records both
- [ ] A non-`InsufficientCredits` failure during a debit propagates (500), not swallowed
- [ ] Migration applied to the **test** DB; `types.ts` regenerated; file-top blocks carry `REFACTOR-R4-P3-02`

## Test plan

- **Existing:** `src/app/api/admin/students/[email]/pricing/__tests__/route.test.ts`,
  `src/app/api/admin/feedback/__tests__/report-status.test.ts` and
  `src/app/api/admin/course-announce/__tests__/route.test.ts` stay green. Use them as the pattern for
  route-level tests of the two POSTs.
- **New (service):** `AdminService.test.ts` with `InMemoryAdminQueryRepository` +
  `InMemoryCreditsRepository`: positive adjust creates a pack with the configured validity; partial
  debit; debit error propagation.
- **New (DB-gated):** `SupabaseAdminQueryRepository.test.ts`. Seed 3 users: a course-only user, a
  booker, and a pack holder with 1 credit. List → 2 rows; low-credit → 1; query by name fragment
  finds the right one; offset/limit page correctly.
- **Manual:** `/admin`, `/admin/students` (search, both tabs, page 2), a student detail page, the
  credit-adjust form (positive, partial negative), and the failed-bookings retry button. There's no
  local admin session, so use the hand-minted `authjs.session-token` cookie flow from the project
  notes.

## Notes / gotchas

- **Search safety.** Pass `p_query` as a parameter and never interpolate it. `ILIKE` wildcards in
  user input (`%`, `_`) only broaden the admin's own search. Harmless, but escape them if exact
  matching matters.
- **Performance.** The correlated subqueries run per student, fine at this scale (hundreds). If it
  ever grows, add `idx_credit_packs_user` / use the existing `idx_bookings_user` (`0001`) and revisit.
- `fetchAllBookings` / `fetchPayments` keep their "latest 100" behaviour (newest first, by design).
  They move into the repository unchanged.
- The admin pages are `force-dynamic` (`admin/layout.tsx:19`). No caching concerns.
- `stripeSessionId: manual-${Date.now()}-${Math.random()…}` becomes `manual-${crypto.randomUUID()}`.
  Same purpose (unique `credit_packs.stripe_payment_id`), just a better generator.

## Out of scope

- Pagination for the admin bookings/payments lists.
- An audit-log viewer beyond the existing per-student list.
- Role management / multi-admin (single-admin threat model stands).
- Changing what counts as "low" (≤ 1 credit).
