# Task 4.9 — Admin Dashboard

**Fix ID:** `ADMIN-01`
**Priority:** P3
**Est. effort:** 8 hours

## Problem

The tutor has no UI for operational tasks. To view students, adjust credits, retry failed bookings, or see the business state, they need a developer to query Redis/Supabase directly. This task builds a protected admin area.

The admin area uses the existing `isAdmin(session)` helper from Task 2.3, reads from Supabase (after Phase 4.5 flip), and lets the tutor perform common operations without developer involvement.

## Scope

**Create:**
- `src/app/admin/layout.tsx` — protected layout that redirects non-admins
- `src/app/admin/page.tsx` — dashboard home
- `src/app/admin/students/page.tsx` — student list
- `src/app/admin/students/[email]/page.tsx` — student detail
- `src/app/admin/bookings/page.tsx` — upcoming + recent bookings
- `src/app/admin/failed-bookings/page.tsx` — dead-letter UI (uses Task 2.3 API)
- `src/app/admin/payments/page.tsx` — payment history
- `src/app/api/admin/students/route.ts` — list students
- `src/app/api/admin/students/[email]/route.ts` — get student detail, adjust credits
- `src/app/api/admin/bookings/route.ts` — list bookings
- `src/app/api/admin/payments/route.ts` — list payments
- `src/components/admin/` — shared admin components

**Modify:**
- `src/auth.ts` — no change, but verify session loading works on the admin routes

**Do not touch:**
- User-facing features
- Any billing or payment logic

## Approach

### Step 1 — Protected layout

```tsx
// src/app/admin/layout.tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!isAdmin(session)) {
    redirect("/");
  }
  return (
    <div className="admin-shell">
      <AdminNav email={session.user.email} />
      <main>{children}</main>
    </div>
  );
}
```

### Step 2 — Dashboard home

Minimal — show 3–5 key metrics. Pull from Supabase:

```tsx
// src/app/admin/page.tsx
export default async function AdminDashboard() {
  const [upcoming, lowCredit, failed, revenue30d] = await Promise.all([
    countUpcomingBookings(),        // bookings with starts_at > now()
    countStudentsWithLowCredits(),  // credits <= 1
    countFailedBookings(),
    sumRevenueLast30Days(),
  ]);

  return (
    <div>
      <h1>Panel de control</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Sesiones próximas" value={upcoming} href="/admin/bookings" />
        <StatCard label="Alumnos con pocos créditos" value={lowCredit} href="/admin/students?filter=low-credit" />
        <StatCard label="Reservas fallidas" value={failed} href="/admin/failed-bookings" tone={failed > 0 ? "alert" : "neutral"} />
        <StatCard label="Ingresos (30 días)" value={`€${revenue30d}`} href="/admin/payments" />
      </div>
    </div>
  );
}
```

### Step 3 — Student list

```tsx
// src/app/admin/students/page.tsx
export default async function StudentsPage({ searchParams }: { searchParams: { filter?: string } }) {
  const students = await fetchStudents({ filter: searchParams.filter });

  return (
    <div>
      <h1>Alumnos</h1>
      <StudentFilters current={searchParams.filter} />
      <table>
        <thead>
          <tr>
            <th>Email</th><th>Nombre</th><th>Créditos</th><th>Caduca</th><th>Próx. sesión</th>
          </tr>
        </thead>
        <tbody>
          {students.map(s => (
            <tr key={s.id}>
              <td><Link href={`/admin/students/${encodeURIComponent(s.email)}`}>{s.email}</Link></td>
              <td>{s.name}</td>
              <td>{s.totalCredits}</td>
              <td>{s.earliestExpiry ? formatDate(s.earliestExpiry) : "—"}</td>
              <td>{s.nextSession ? formatDateTime(s.nextSession) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Step 4 — Student detail + credit adjustment

```tsx
// src/app/admin/students/[email]/page.tsx
export default async function StudentDetail({ params }: { params: { email: string } }) {
  const email = decodeURIComponent(params.email);
  const [student, packs, bookings, audit] = await Promise.all([
    fetchStudent(email),
    fetchCreditPacks(email),
    fetchBookings(email),
    fetchAuditLog(email),
  ]);

  return (
    <div>
      <h1>{student.name}</h1>
      <p>{student.email}</p>

      <section>
        <h2>Créditos</h2>
        <CreditPacksTable packs={packs} />
        <AdjustCreditsForm email={email} /> {/* Client component */}
      </section>

      <section>
        <h2>Reservas</h2>
        <BookingsList bookings={bookings} />
      </section>

      <section>
        <h2>Historial</h2>
        <AuditLog entries={audit} />
      </section>
    </div>
  );
}
```

The `AdjustCreditsForm` is a client component calling `POST /api/admin/students/[email]`:

```tsx
// src/components/admin/AdjustCreditsForm.tsx
"use client";

export function AdjustCreditsForm({ email }: { email: string }) {
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState("");

  async function submit() {
    if (!reason.trim()) return alert("Razón obligatoria");
    const res = await fetch(`/api/admin/students/${encodeURIComponent(email)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "adjust_credits", amount, reason }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      alert("Error al ajustar créditos");
    }
  }

  return (
    <div className="adjust-form">
      <label>Cantidad (+/-):
        <input type="number" value={amount} onChange={e => setAmount(parseInt(e.target.value))} />
      </label>
      <label>Razón (registrada en el audit log):
        <input type="text" value={reason} onChange={e => setReason(e.target.value)} required />
      </label>
      <button onClick={submit}>Ajustar</button>
    </div>
  );
}
```

### Step 5 — Admin API routes

Each admin API route:

1. Checks `isAdmin(await auth())` → 403 if not admin
2. Validates input with Zod
3. Delegates to the service layer
4. Returns JSON

```ts
// src/app/api/admin/students/[email]/route.ts
const AdjustSchema = z.object({
  action: z.literal("adjust_credits"),
  amount: z.number().int(),
  reason: z.string().min(1).max(500),
});

export async function POST(req: NextRequest, { params }: { params: { email: string } }) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = AdjustSchema.parse(await req.json());
  const email = decodeURIComponent(params.email);

  if (body.amount > 0) {
    await creditService.addCredits({
      email, name: "",
      amount: body.amount,
      packLabel: `Ajuste manual: ${body.reason}`,
      stripeSessionId: `manual-${Date.now()}`,  // non-colliding ID
    });
  } else {
    // Negative adjustment — decrement until amount reached
    for (let i = 0; i < Math.abs(body.amount); i++) {
      await creditService.useCredit(email).catch(() => { /* ignore if 0 */ });
    }
  }

  // Audit entry already written by creditService; add admin attribution
  await auditRepository.append(email, {
    action: "admin_adjust",
    amount: body.amount,
    reason: body.reason,
    by: session.user.email,
  });

  return NextResponse.json({ ok: true });
}
```

### Step 6 — Failed bookings UI

Builds on the API from Task 2.3:

```tsx
// src/app/admin/failed-bookings/page.tsx
export default async function FailedBookingsPage() {
  const entries = await fetchFailedBookings();

  return (
    <div>
      <h1>Reservas fallidas</h1>
      {entries.length === 0 && <p>✅ No hay reservas fallidas.</p>}
      <table>
        <thead><tr><th>Fecha fallo</th><th>Alumno</th><th>Slot</th><th>Error</th><th></th></tr></thead>
        <tbody>
          {entries.map(e => (
            <tr key={e.stripeSessionId}>
              <td>{formatDateTime(e.failedAt)}</td>
              <td>{e.email}</td>
              <td>{formatDateTime(e.startIso)}</td>
              <td>{e.error}</td>
              <td><RetryButton stripeSessionId={e.stripeSessionId} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Step 7 — Styling

Keep the admin UI purely functional — no design system needed. Use Tailwind classes directly. The design principle: tables and forms, not dashboards with charts. Charts can be added later if needed.

## Acceptance Criteria

- [ ] Admin routes under `/admin/*` redirect non-admins to `/`
- [ ] Dashboard shows 4 key stats
- [ ] Student list paginates or filters for scale (handle > 100 students)
- [ ] Student detail shows packs, bookings, audit log
- [ ] Credit adjustment requires a reason and writes to audit log with admin attribution
- [ ] Failed bookings page shows entries and retry button
- [ ] Retry calls Task 2.3's API and shows success/failure
- [ ] Payments page shows last 30 days with total revenue
- [ ] All admin API routes gated by `isAdmin` check
- [ ] All admin APIs validated with Zod
- [ ] Manual test: sign in as tutor → access `/admin` → succeeds
- [ ] Manual test: sign in as student → access `/admin` → redirects to `/`
- [ ] Manual test: adjust a test student's credits → verify change reflected
- [ ] Manual test: retry a simulated failed booking → succeeds
- [ ] Fix-ID comments added

## Reference

See `docs/refactor/PLAN.md` → section **11.2 Admin Dashboard**.

## Testing

Unit test the admin API routes:

```ts
describe("POST /api/admin/students/[email]", () => {
  it("rejects non-admins", async () => {
    mockSession({ email: "not-admin@example.com" });
    const res = await POST(mockReq({ action: "adjust_credits", amount: 1, reason: "test" }), { params: { email: "x@y.com" } });
    expect(res.status).toBe(403);
  });

  it("adjusts credits positively", async () => {
    mockSession({ email: "admin@example.com" });
    // ... etc
  });
});
```

E2E test the admin flow (extend Task 4.7):

```ts
test("admin can view students and adjust credits", async ({ page }) => {
  await loginAs(page, "e2e-admin@example.com", "E2E Admin");
  await page.goto("/admin/students");
  // ...
});
```

## Out of Scope

- Advanced filtering / search on students
- Export to CSV — can add later if needed
- Real-time updates (websockets) — the tutor doesn't need real-time
- Multi-admin collaboration features (comments, assignments)
- Impersonation / "log in as student" — high security risk, not needed
- Chart visualizations

## Rollback

Entirely additive. Remove `/admin/*` routes and the problem disappears. Admin APIs can be left in place — they 403 unless called by an admin.
