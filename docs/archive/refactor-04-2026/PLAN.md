# Complete Codebase Audit & Architecture Redesign

**Project:** gustavoai.dev — Online Tutoring Platform  
**Stack:** Next.js 14 / TypeScript / Stripe / Google SSO / Zoom Video SDK / Upstash Redis / Gemini AI  
**Date:** April 2026  

---

## 1. 🔍 Key Issues Summary (Top 10)

### 1. CRITICAL — Race condition on credit decrement (`kv.ts`)
`decrementCredit()` does a `GET` → read → `SET` cycle. Two concurrent `/api/book` requests for the same student can both read `credits: 1`, both succeed, and create two bookings while only consuming one credit. Redis has no native CAS — this requires a Lua script or `WATCH`/`MULTI` (unavailable in Upstash REST).

### 2. CRITICAL — `GET /api/stripe/session` has no auth gate
Anyone who knows (or brute-forces) a `pi_xxx` payment intent ID can retrieve the student's email, name, and payment metadata. This route has zero authentication — no `auth()` call, no ownership check.

### 3. CRITICAL — Duplicate Redis client in SSE route
`src/app/api/sse/route.ts` creates its own `Redis.fromEnv()` instead of importing the shared `kv` singleton from `lib/redis.ts`. This contradicts the ARCH-02 fix applied everywhere else and wastes a connection per cold start.

### 4. HIGH — `setTimeout` in serverless for Zoom session termination
The webhook uses `void (async () => { await new Promise(r => setTimeout(r, delayMs)); ... })()` to schedule Zoom session cleanup. On Vercel, the function instance is recycled after ~10s of inactivity. A 70-minute timer will **never fire**. This is acknowledged with a TODO but remains unresolved.

### 5. HIGH — Massive code duplication in webhook
`handleSingleSessionPayment()` and the `checkout.session.completed` branch contain ~100 lines of nearly identical logic (slot re-check, reschedule, calendar creation, email, setTimeout). Any bug fix must be applied twice.

### 6. HIGH — No authorization check on Zoom token endpoint
`POST /api/zoom/token` verifies the user is authenticated but does **not** verify they are a participant of that session. Any authenticated user who knows an `eventId` can generate a valid Zoom JWT and join someone else's class.

### 7. MEDIUM — Chat API (`/api/chat`) requires no authentication
The AI chatbot is rate-limited by IP but has no auth requirement. This means unauthenticated visitors can consume Gemini API tokens. While this may be intentional (public-facing chatbot), it's a cost risk if abused via VPNs/proxies.

### 8. MEDIUM — Cancellation token as session join URL
The join URL is `/sesion/{cancelToken}`. The same token that lets you **join** a class also lets you **cancel** it. If the link is shared (e.g., forwarded email), anyone with it can cancel the booking.

### 9. MEDIUM — No CSRF protection on state-mutating POST routes
Next.js API routes using `POST` with cookie-based auth (NextAuth JWT) are vulnerable to CSRF. None of the POST routes check `Origin`/`Referer` headers or use CSRF tokens.

### 10. MEDIUM — All business-critical data lives only in Redis
Credits, bookings, audit logs, Zoom session records, and cancellation tokens are stored exclusively in Upstash Redis with TTLs. If a key expires or Redis has an outage, there is **no recovery path**. Credit records have no TTL, but booking records (`cancel:{token}`) do — once expired, booking history is lost forever.

---

## 2. 🛠 Refactor Plan (Prioritized)

### Phase 1 — Security Fixes (Week 1-2)

| Priority | Issue | Fix |
|----------|-------|-----|
| P0 | Race condition on credits | Implement Lua script for atomic decrement (see §6) |
| P0 | `/api/stripe/session` no auth | Add `auth()` + email ownership check |
| P0 | Zoom token — no session membership check | Verify user email matches booking record |
| P1 | CSRF on POST routes | Add `Origin` header validation middleware |
| P1 | Separate join token from cancel token | Issue a read-only join token distinct from the cancel token |
| P1 | SSE duplicate Redis client | Replace `Redis.fromEnv()` with `import { kv }` |

### Phase 2 — Reliability Fixes (Week 3-4)

| Priority | Issue | Fix |
|----------|-------|-----|
| P1 | setTimeout in serverless | Replace with Upstash QStash scheduled message |
| P1 | Webhook code duplication | Extract shared `processSingleSession()` function |
| P1 | Dead-letter recovery | Build admin API to retry failed bookings |
| P2 | Chat auth | Add optional auth; apply stricter rate limits to unauthenticated users |

### Phase 3 — Architecture (Week 5-8)

| Priority | Issue | Fix |
|----------|-------|-----|
| P2 | Repository pattern | Introduce `ICreditsRepository`, `IBookingRepository` interfaces |
| P2 | Service layer | Extract `BookingService`, `PaymentService`, `SessionService` |
| P3 | Database introduction | Add Supabase, implement repository adapters |
| P3 | Migrate credits to DB | Redis becomes cache layer, DB is source of truth |

### Phase 4 — Polish (Week 9-12)

| Priority | Issue | Fix |
|----------|-------|-----|
| P3 | Testing | Add integration tests for payment + booking flow |
| P3 | Observability | Add Sentry, structured error tracking |
| P3 | Admin dashboard | Build admin page for session management |

---

## 3. 🧱 Suggested Folder Structure

```
src/
├── app/                          # Next.js App Router (routes + pages only)
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── book/route.ts         # Thin handler → calls BookingService
│   │   ├── cancel/route.ts
│   │   ├── chat/route.ts
│   │   ├── chat-session/route.ts
│   │   ├── credits/route.ts
│   │   ├── availability/route.ts
│   │   ├── sse/route.ts
│   │   ├── stripe/
│   │   │   ├── checkout/route.ts
│   │   │   ├── session/route.ts
│   │   │   └── webhook/route.ts
│   │   ├── zoom/
│   │   │   ├── token/route.ts
│   │   │   └── end/route.ts
│   │   └── my-bookings/route.ts
│   ├── (public)/                 # Public pages (landing, terms, privacy)
│   │   ├── page.tsx
│   │   ├── privacidad/page.tsx
│   │   └── terminos/page.tsx
│   ├── (protected)/              # Auth-required pages
│   │   ├── area-personal/page.tsx
│   │   ├── sesion/[token]/page.tsx
│   │   ├── sesion-confirmada/page.tsx
│   │   ├── pago-exitoso/page.tsx
│   │   ├── reserva-confirmada/page.tsx
│   │   └── cancelar/page.tsx
│   ├── layout.tsx
│   └── globals.css
│
├── domain/                       # Pure business types & interfaces
│   ├── types.ts                  # CreditRecord, BookingRecord, etc.
│   ├── errors.ts                 # Domain error classes
│   └── repositories/             # Interface contracts (no implementation)
│       ├── ICreditsRepository.ts
│       ├── IBookingRepository.ts
│       └── ISessionRepository.ts
│
├── services/                     # Application/business logic
│   ├── BookingService.ts         # Orchestrates: credits + calendar + zoom + email
│   ├── PaymentService.ts         # Stripe checkout creation, webhook processing
│   ├── CreditService.ts          # Credit operations with atomic guarantees
│   ├── SessionService.ts         # Zoom session lifecycle
│   └── ChatService.ts            # Gemini AI interaction
│
├── infrastructure/               # External system adapters
│   ├── redis/
│   │   ├── client.ts             # Singleton kv instance
│   │   ├── RedisCreditsRepo.ts   # Implements ICreditsRepository
│   │   ├── RedisBookingRepo.ts   # Implements IBookingRepository
│   │   └── RedisSessionRepo.ts   # Implements ISessionRepository
│   ├── supabase/                 # Future — same interfaces
│   │   ├── client.ts
│   │   ├── SupabaseCreditsRepo.ts
│   │   └── SupabaseBookingRepo.ts
│   ├── stripe/
│   │   ├── client.ts
│   │   └── webhook-handlers.ts
│   ├── google/
│   │   ├── calendar.ts
│   │   └── auth.ts
│   ├── zoom/
│   │   ├── jwt.ts
│   │   └── session.ts
│   ├── email/
│   │   └── resend.ts
│   └── gemini/
│       └── client.ts
│
├── middleware/                    # Cross-cutting concerns
│   ├── csrf.ts
│   ├── rate-limit.ts
│   └── auth-guard.ts
│
├── components/                   # React components (unchanged structure)
├── features/                     # Feature-specific components
├── hooks/                        # React hooks
├── constants/                    # Static configuration
└── lib/                          # Shared utilities
    ├── schemas.ts                # Zod schemas
    ├── validation.ts
    ├── logger.ts
    └── ip-utils.ts
```

**Key principle:** Route handlers become thin dispatchers. All business logic lives in `services/`. All external I/O lives in `infrastructure/`. The `domain/` layer has zero imports from infrastructure.

---

## 4. 🗄 Future Database Schema (Supabase/Postgres)

```sql
-- ═══════════════════════════════════════════════════════════
-- USERS
-- ═══════════════════════════════════════════════════════════
-- Currently: implicit — email/name come from Google SSO JWT,
-- not stored anywhere persistent.

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'student'
                CHECK (role IN ('student', 'teacher', 'admin')),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);

-- ═══════════════════════════════════════════════════════════
-- CREDIT PACKS
-- ═══════════════════════════════════════════════════════════
-- Currently: Redis key `credits:{email}` → CreditRecord JSON.
-- One record per student; overwritten on each purchase.
-- Problem: purchase history is lost on overwrite.

CREATE TABLE credit_packs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  pack_size         INT NOT NULL CHECK (pack_size IN (5, 10)),
  credits_remaining INT NOT NULL CHECK (credits_remaining >= 0),
  stripe_payment_id TEXT UNIQUE NOT NULL, -- idempotency
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_packs_user ON credit_packs (user_id);
CREATE INDEX idx_credit_packs_active ON credit_packs (user_id, expires_at)
  WHERE credits_remaining > 0;

-- ═══════════════════════════════════════════════════════════
-- BOOKINGS
-- ═══════════════════════════════════════════════════════════
-- Currently: Redis key `cancel:{token}` → BookingRecord JSON
-- with TTL. Also indexed in sorted set `bookings:{email}`.
-- Booking history is lost when TTL expires.

CREATE TABLE bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  credit_pack_id  UUID REFERENCES credit_packs(id), -- NULL for paid/free sessions
  session_type    TEXT NOT NULL
                  CHECK (session_type IN ('free15min','session1h','session2h','pack')),
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('confirmed','cancelled','completed','no_show')),
  calendar_event_id TEXT,
  cancel_token    TEXT UNIQUE,
  join_token      TEXT UNIQUE,  -- separate from cancel token (security fix)
  note            TEXT,
  stripe_payment_id TEXT, -- for single-session bookings
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_user ON bookings (user_id);
CREATE INDEX idx_bookings_starts ON bookings (starts_at);
CREATE INDEX idx_bookings_cancel_token ON bookings (cancel_token)
  WHERE cancel_token IS NOT NULL;
CREATE INDEX idx_bookings_join_token ON bookings (join_token)
  WHERE join_token IS NOT NULL;

-- ═══════════════════════════════════════════════════════════
-- ZOOM SESSIONS
-- ═══════════════════════════════════════════════════════════
-- Currently: Redis key `zoom:session:{eventId}` → ZoomSessionRecord
-- with TTL (durationWithGrace + 24h).

CREATE TABLE zoom_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES bookings(id),
  session_name    TEXT NOT NULL,
  session_passcode TEXT NOT NULL,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_zoom_sessions_booking ON zoom_sessions (booking_id);

-- ═══════════════════════════════════════════════════════════
-- PAYMENTS
-- ═══════════════════════════════════════════════════════════
-- Currently: no payment records stored. Stripe is the only
-- source of truth. This table adds local auditing.

CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  stripe_payment_id   TEXT UNIQUE NOT NULL,
  amount_cents        INT NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'eur',
  status              TEXT NOT NULL DEFAULT 'succeeded'
                      CHECK (status IN ('pending','succeeded','refunded','failed')),
  checkout_type       TEXT NOT NULL CHECK (checkout_type IN ('pack','single')),
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_user ON payments (user_id);

-- ═══════════════════════════════════════════════════════════
-- AUDIT LOG (append-only)
-- ═══════════════════════════════════════════════════════════
-- Currently: Redis list `audit:{email}` capped at 100 entries.
-- Entries are lost if Redis is flushed.

CREATE TABLE audit_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user ON audit_log (user_id);
CREATE INDEX idx_audit_log_action ON audit_log (action);
```

### Redis-to-Database Field Mapping

| Redis Key Pattern | DB Table | Notes |
|---|---|---|
| `credits:{email}` | `credit_packs` | One row per purchase instead of overwrite |
| `cancel:{token}` | `bookings` | `cancel_token` column; no TTL needed |
| `bookings:{email}` (sorted set) | `bookings` | Query by `user_id + status` |
| `zoom:session:{eventId}` | `zoom_sessions` | Linked by `booking_id` |
| `audit:{email}` (list) | `audit_log` | Unlimited history, not capped at 100 |
| `webhook:single:{id}` | `payments` | `stripe_payment_id UNIQUE` constraint |
| `slot:lock:{startIso}` | **Keep in Redis** | Ephemeral lock, not persistent data |
| `rl:*` (rate limits) | **Keep in Redis** | Rate limiting is Redis's sweet spot |
| `chat:session:{eventId}` | **Keep in Redis** | Ephemeral chat, 24h TTL is correct |
| `failed:booking:*` | `audit_log` | Dead-letter entries become audit records |

---

## 5. 🔄 Migration Plan (Redis → Database)

### Step 1: Repository Interfaces (No behavior change)

```typescript
// domain/repositories/ICreditsRepository.ts
export interface ICreditsRepository {
  getCredits(email: string): Promise<CreditResult | null>;
  addCredits(email: string, name: string, amount: number,
             packLabel: string, stripeId: string): Promise<void>;
  decrementCredit(email: string): Promise<{ ok: boolean; remaining: number }>;
  restoreCredit(email: string): Promise<{ ok: boolean; credits: number }>;
}
```

Wrap existing `kv.ts` functions in a `RedisCreditsRepo` class that implements this interface. All route handlers import from the interface, not from `kv.ts` directly.

### Step 2: Dual-Write Phase

```typescript
// services/CreditService.ts
class CreditService {
  constructor(
    private primary: ICreditsRepository,   // Redis (source of truth)
    private secondary?: ICreditsRepository // Supabase (shadow writes)
  ) {}

  async addCredits(...args) {
    await this.primary.addCredits(...args);
    // Shadow write — fire-and-forget, log failures
    this.secondary?.addCredits(...args).catch(err =>
      log("warn", "Shadow write failed", { error: String(err) })
    );
  }
}
```

Run dual-write for 2-4 weeks. Compare Redis and Supabase states daily with a reconciliation script.

### Step 3: Swap Primary

Once Supabase data is verified consistent, swap: Supabase becomes primary, Redis becomes cache.

```typescript
// Flip the constructor args
const service = new CreditService(
  supabaseRepo,  // now primary
  redisRepo      // now cache / fallback
);
```

### Step 4: Remove Redis for Persistent Data

After a stabilization period, remove Redis writes for credits and bookings. Redis remains for rate limiting, slot locks, ephemeral chat, and caching.

---

## 6. 🔐 Security Fixes

### Fix 1: Atomic Credit Decrement (P0)

The current `decrementCredit` has a TOCTOU race condition:

```typescript
// CURRENT (BROKEN) — lib/kv.ts
const record = await kv.get(k);     // Step 1: read
// ... another request reads the same value here ...
record.credits -= 1;
await kv.set(k, updated);           // Step 2: write
```

**Fix:** Use a Lua script for atomic check-and-decrement:

```typescript
// infrastructure/redis/RedisCreditsRepo.ts
const DECREMENT_SCRIPT = `
  local key = KEYS[1]
  local raw = redis.call('GET', key)
  if not raw then return cjson.encode({ok=false, remaining=0}) end
  local record = cjson.decode(raw)

  -- Check expiry
  local now = tonumber(ARGV[1])
  local expires = tonumber(ARGV[2]) or 0
  if expires > 0 and now > expires then
    return cjson.encode({ok=false, remaining=0})
  end

  if record.credits <= 0 then
    return cjson.encode({ok=false, remaining=0})
  end

  record.credits = record.credits - 1
  record.lastUpdated = ARGV[3]
  redis.call('SET', key, cjson.encode(record))
  return cjson.encode({ok=true, remaining=record.credits})
`;

async decrementCredit(email: string) {
  const k = `credits:${email.toLowerCase().trim()}`;
  const record = await kv.get<CreditRecord>(k);
  if (!record) return { ok: false, remaining: 0 };

  const expiresMs = record.expiresAt
    ? new Date(record.expiresAt).getTime()
    : 0;

  const result = await kv.eval(
    DECREMENT_SCRIPT,
    [k],
    [Date.now(), expiresMs, new Date().toISOString()]
  );
  return JSON.parse(result as string);
}
```

> **Note:** Upstash REST supports `EVAL` via `kv.eval()`. If targeting Supabase later, this becomes a simple SQL `UPDATE ... SET credits = credits - 1 WHERE credits > 0 RETURNING credits`.

### Fix 2: Auth Gate on `/api/stripe/session` (P0)

```typescript
// src/app/api/stripe/session/route.ts — ADD these lines
export async function GET(req: NextRequest) {
  // ── Auth gate (SECURITY FIX) ──────────────────────────
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const paymentIntentId = req.nextUrl.searchParams.get("payment_intent_id");
  // ... existing validation ...

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

  // ── Ownership check (SECURITY FIX) ────────────────────
  const metaEmail = intent.metadata?.student_email ?? "";
  if (metaEmail.toLowerCase() !== session.user.email.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ... rest of handler ...
}
```

### Fix 3: Zoom Token Authorization (P0)

```typescript
// src/app/api/zoom/token/route.ts — ADD booking membership check

// After looking up the Zoom session record:
const record = await kv.get<ZoomSessionRecord>(`zoom:session:${eventId}`);
if (!record) {
  return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
}

// ── Booking membership check (SECURITY FIX) ─────────────────────
// Look up the booking associated with this eventId and verify the
// authenticated user is either the student or the tutor.
const bookingKey = `cancel:*`; // We need a reverse index
// Better approach: store participant email in the zoom session record
// In createCalendarEvent(), add `studentEmail` to ZoomSessionRecord:
const isTutor = session.user.email === process.env.TUTOR_EMAIL;
// For now, check if any booking token for this email references this eventId
// Long-term: add studentEmail to ZoomSessionRecord in calendar.ts
```

**Proper fix in `calendar.ts` → `createCalendarEvent()`:**

```typescript
// Add studentEmail to ZoomSessionRecord
const zoomRecord: ZoomSessionRecord & { studentEmail: string } = {
  ...existingFields,
  studentEmail: params.studentEmail, // NEW — pass from caller
};
```

Then in the token endpoint:

```typescript
if (!isTutor && record.studentEmail !== session.user.email) {
  return NextResponse.json({ error: "No autorizado" }, { status: 403 });
}
```

### Fix 4: CSRF Protection Middleware

```typescript
// middleware/csrf.ts
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_BASE_URL,
].filter(Boolean) as string[];

export function validateOrigin(req: NextRequest): boolean {
  // Skip for Stripe webhooks (they have signature verification)
  if (req.nextUrl.pathname === "/api/stripe/webhook") return true;

  const origin = req.headers.get("origin");
  if (!origin) return false; // browsers always send Origin on POST

  return ALLOWED_ORIGINS.some(allowed =>
    origin === allowed || origin === new URL(allowed).origin
  );
}

// In each POST route handler (or as Next.js middleware):
if (req.method === "POST" && !validateOrigin(req)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### Fix 5: Separate Join Token from Cancel Token

```typescript
// calendar.ts — createCancellationToken should also create a join token
export async function createBookingTokens(
  record: Omit<BookingRecord, "used">
): Promise<{ cancelToken: string; joinToken: string }> {
  const payload = `${record.eventId}:${record.email}:${record.startsAt}`;
  const cancelToken = signToken(payload);
  const joinToken = signToken(`join:${payload}`); // different prefix

  // Store both tokens pointing to the same booking
  await kv.set(`cancel:${cancelToken}`, { ...record, used: false }, { ex: ttlSecs });
  await kv.set(`join:${joinToken}`, { eventId: record.eventId, email: record.email }, { ex: ttlSecs });

  return { cancelToken, joinToken };
}
```

Join URL becomes `/sesion/{joinToken}`, cancel URL stays `/cancelar?token={cancelToken}`.

### Fix 6: Fix SSE Route Redis Import

```diff
// src/app/api/sse/route.ts
- import { Redis } from "@upstash/redis";
- const kv = Redis.fromEnv();
+ import { kv } from "@/lib/redis";
```

---

## 7. ⚡ Performance Improvements

### 7.1 Replace setTimeout with QStash

```typescript
// Instead of:
void (async () => {
  await new Promise(r => setTimeout(r, delayMs));
  await fetch(`/api/zoom/end`, ...);
})();

// Use Upstash QStash:
import { Client } from "@upstash/qstash";
const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

await qstash.publishJSON({
  url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/zoom/end`,
  body: { eventId },
  headers: { "X-Internal-Secret": process.env.INTERNAL_SECRET! },
  delay: delayMs / 1000, // QStash uses seconds
});
```

### 7.2 Cache Availability Slots

The `/api/availability` route calls Google Calendar's Freebusy API on every request. For a slot 2+ weeks in the future, availability changes very infrequently.

```typescript
// Cache strategy:
// - Slots for today/tomorrow: no cache (high change rate)
// - Slots 2-7 days out: cache 5 minutes
// - Slots 8+ days out: cache 15 minutes

const daysAhead = Math.floor(
  (new Date(date).getTime() - Date.now()) / 86_400_000
);
const cacheTTL = daysAhead <= 1 ? 0 : daysAhead <= 7 ? 300 : 900;

if (cacheTTL > 0) {
  const cached = await kv.get(`avail:${date}:${duration}`);
  if (cached) return NextResponse.json(cached);
}

const slots = await getAvailableSlots(date, duration);

if (cacheTTL > 0) {
  await kv.set(`avail:${date}:${duration}`, { slots }, { ex: cacheTTL });
}
```

### 7.3 Google Calendar Auth Singleton

`getCalendar()` in `calendar.ts` creates a new `GoogleAuth` instance on every call. The credentials don't change, so this should be a module-level singleton:

```typescript
// calendar.ts
let _calendar: ReturnType<typeof google.calendar> | null = null;

function getCalendar() {
  if (_calendar) return _calendar;
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  _calendar = google.calendar({ version: "v3", auth });
  return _calendar;
}
```

### 7.4 Reduce Webhook Processing Time

The Stripe webhook currently does calendar event creation + email sending synchronously. Stripe expects webhook responses within 20 seconds and will retry on timeout.

**Strategy:** Acknowledge the webhook immediately, process asynchronously:

```typescript
// Future pattern with QStash:
// 1. Webhook receives event → validates → enqueues to QStash → returns 200
// 2. QStash delivers to /api/internal/process-booking
// 3. Processing handler does calendar + email + notifications
```

For now (without QStash), at minimum move email sending to `waitUntil()`:

```typescript
// In webhook POST handler (Vercel supports waitUntil via next/server):
import { waitUntil } from "next/server";

// After creating calendar event:
waitUntil(
  Promise.all([
    sendConfirmationEmail({ ... }),
    sendNewBookingNotificationEmail({ ... }),
  ]).catch(err => log("error", "Deferred email failed", { error: String(err) }))
);

return NextResponse.json({ received: true }); // Return immediately
```

---

## 8. 🎨 UI/UX Enhancements

### 8.1 Booking Flow

- **Add a booking summary step** before payment. Currently the flow goes from slot selection directly to Stripe checkout. Add an intermediate confirmation screen showing: session type, date/time, price, and a "Confirm & Pay" button.
- **Show slot timezone clearly.** The timezone indicator should be prominent, not a small suffix. Students in different timezones should see their local time as the primary display.
- **Add optimistic UI for credit deduction.** After clicking "Book with credits," immediately show `credits - 1` in the UI while the API call is in flight. Roll back on error.

### 8.2 Payment Experience

- **Add payment status polling fallback.** If the SSE connection times out (24s on Vercel Hobby), the UI should automatically fall back to polling `/api/credits` every 3 seconds for 60 seconds. Currently it just shows "timeout."
- **Show a progress indicator** during webhook processing: "Payment received → Creating your session → Sending confirmation email → Done!"

### 8.3 Session Joining

- **Pre-join device check** (already implemented in `PreJoinSetup.tsx`) — ensure it tests actual media capture, not just permission grants. Browsers can grant permissions but return empty streams if the device is in use by another app.
- **Add session countdown.** Show a countdown timer on the session page: "Your class starts in 2h 34m." Make the "Join" button disabled until 10 minutes before start, with a clear message explaining why.

### 8.4 Personal Area

- **Show session history**, not just upcoming sessions. Once bookings move to the database, the personal area can show completed sessions with date, type, and status.
- **Add a credit usage timeline** showing when credits were purchased, used, and when they expire. This replaces the opaque "You have X credits" with full transparency.

### 8.5 Error States

- **Replace generic error toasts with contextual recovery actions.** Instead of "Error al reservar," show "This slot was just booked by someone else. [Show available slots]" for 409 errors.
- **Add a connection-lost banner** for the Zoom session that distinguishes between "Your internet is unstable" and "The session has ended."

---

## 9. 🎥 Video System Improvements (Zoom)

### 9.1 Session Membership Authorization

As noted in §6, any authenticated user can currently generate a Zoom JWT for any session. Fix by adding `studentEmail` to `ZoomSessionRecord` and checking membership in `/api/zoom/token`.

### 9.2 Session Lifecycle State Machine

```
  CREATED ──(first participant joins)──→ ACTIVE
     │                                      │
     │ (TTL expires)                        │ (all leave OR grace period ends)
     ↓                                      ↓
  EXPIRED                                ENDED
```

Currently there's no ACTIVE state — the system doesn't know if anyone has actually joined. When migrating to a database, add a `started_at` column to `zoom_sessions` and update it when the first `POST /api/zoom/token` is called.

### 9.3 Session Chat Persistence

In-session chat (`chat:session:{eventId}`) expires after 24h. For a tutoring platform, chat history (links shared, code snippets discussed) has educational value. When the database is introduced, persist chat messages to a `session_messages` table before the Redis key expires.

### 9.4 Zoom Session Cleanup Reliability

Replace the `setTimeout` approach with a reliable scheduled job. Options, in order of complexity:

1. **Upstash QStash** (recommended) — schedule a delayed HTTP call to `/api/zoom/end`
2. **Vercel Cron** — run a cron job every 5 minutes that checks for sessions past their end time
3. **Database trigger** — when using Supabase, use `pg_cron` to expire sessions

### 9.5 Token Reuse Prevention

Currently, once a Zoom JWT is issued, it's valid for 1 hour regardless. If a student shares their join link, anyone with the link gets a valid token.

**Fix:** Track issued tokens per session and enforce a maximum concurrent users count:

```typescript
const issued = await kv.scard(`zoom:tokens:${eventId}`);
if (issued >= 2 && !isTutor) { // max 1 student + 1 tutor
  return NextResponse.json({ error: "Session is full" }, { status: 403 });
}
await kv.sadd(`zoom:tokens:${eventId}`, session.user.email);
```

---

## 10. 🧪 Testing Strategy

### Unit Tests (existing: `calendar.test.ts`, `kv.test.ts`, `validation.test.ts`)

**Expand to cover:**

| Module | Test Cases |
|--------|-----------|
| `kv.ts` | Credit decrement race condition (mock concurrent calls), expiry handling, idempotent webhook skipping |
| `calendar.ts` | Slot generation across DST transitions, slot locking atomicity, cancellation token HMAC verification with timing-safe compare |
| `zoom.ts` | JWT payload correctness, expiry calculation, passcode length |
| `schemas.ts` | All Zod schemas with valid/invalid inputs, edge cases (empty strings, wrong types) |
| `email.ts` | HTML escaping of malicious inputs (`<script>`, `"onload=`) |

### Integration Tests (new)

```typescript
// __tests__/integration/booking-flow.test.ts
// Test the full booking flow with mocked externals:

describe("Booking Flow", () => {
  it("should decrement credit atomically", async () => {
    // Setup: student with 1 credit
    // Action: two concurrent POST /api/book requests
    // Assert: exactly one succeeds, one fails with "Sin créditos"
  });

  it("should prevent double-booking the same slot", async () => {
    // Setup: available slot at 10:00
    // Action: two concurrent bookings for the same slot
    // Assert: one gets 200, one gets 409
  });

  it("should handle webhook idempotency", async () => {
    // Action: send the same webhook event twice
    // Assert: credits added only once
  });
});
```

### E2E Tests (Playwright)

```typescript
// e2e/booking.spec.ts
test("student can book a free 15-min session", async ({ page }) => {
  // 1. Sign in with Google (mock OAuth)
  // 2. Select a date → see available slots
  // 3. Pick a slot → fill in the note
  // 4. Confirm booking → see confirmation page
  // 5. Check email was sent (mock Resend)
});

test("student can purchase a pack and use credits", async ({ page }) => {
  // 1. Sign in
  // 2. Select "Pack 5 horas"
  // 3. Complete Stripe checkout (test mode)
  // 4. Wait for SSE credits_ready
  // 5. Book a session using pack credits
  // 6. Verify credit count decreased
});
```

### Test Infrastructure

```json
// package.json additions
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern='__tests__/(?!integration|e2e)'",
    "test:integration": "jest --testPathPattern='__tests__/integration'",
    "test:e2e": "playwright test",
    "test:ci": "npm run test:unit && npm run test:integration"
  }
}
```

---

## 11. 🚀 Advanced Improvements

### 11.1 Observability Stack

**Structured logging** is already in place via `lib/logger.ts`. Next steps:

1. **Error tracking:** Add Sentry (`@sentry/nextjs`) with source maps. Configure the Sentry Next.js plugin to auto-instrument API routes and React error boundaries.
2. **Business metrics:** Track via structured logs that can be queried in Vercel Logs or forwarded to Datadog/Grafana:
   - `booking.created` — session type, student email, latency
   - `payment.succeeded` — amount, checkout type, webhook latency
   - `credits.low` — alert when a student's credits hit 1
   - `zoom.session.created` / `zoom.session.ended`
3. **Uptime monitoring:** Use Vercel's built-in checks or UptimeRobot on critical endpoints: `/api/availability`, `/api/credits`.

### 11.2 Admin Dashboard

Build a protected route at `/admin` (check `email === TUTOR_EMAIL`) with:

- List of upcoming sessions with join links
- Student roster with credit balances
- Failed booking recovery (retry dead-letter entries)
- Manual credit adjustment with audit log
- Revenue dashboard (Stripe data)

### 11.3 Webhook Reliability

Stripe webhooks can be delayed or repeated. Current mitigations are good (signature verification, idempotency keys) but could be strengthened:

1. **Store all received webhook events** in a `webhook_events` table with the full payload, for debugging and replay.
2. **Use Stripe's `created` timestamp** instead of server time for ordering, to handle out-of-order delivery.
3. **Add `payment_intent.payment_failed`** handler to notify the admin when a payment fails.

### 11.4 Environment & Secrets

- **Rotate `CANCEL_SECRET` periodically.** Support two secrets simultaneously during rotation (try the new secret first, fall back to the old one).
- **Move `INTERNAL_SECRET`** from a shared secret to a proper service authentication mechanism (e.g., Vercel's `CRON_SECRET` for cron jobs, QStash's signature verification for scheduled tasks).
- **Add `NEXT_PUBLIC_` prefix audit.** Ensure no server-only secrets are accidentally prefixed with `NEXT_PUBLIC_`. Currently this is clean.

### 11.5 Internationalization Readiness

The app is currently Spanish-only. To prepare for i18n without a full rewrite:

1. Extract all user-facing strings to a `messages/es.json` file
2. Use a thin `t(key)` wrapper that reads from the JSON
3. When English support is needed, add `messages/en.json` and switch based on browser locale

### 11.6 API Versioning

When introducing the database, the API response shapes may change. Add versioning from the start:

```typescript
// All API routes accept ?v=1 (current) or ?v=2 (new)
// Default to v1 for backward compatibility
const version = req.nextUrl.searchParams.get("v") ?? "1";
```

This prevents breaking the mobile app or any third-party integrations during migration.
