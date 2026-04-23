# gustavoai.dev — Project Context

## Stack
Next.js 14 (App Router) · TypeScript strict · NextAuth v5 · Supabase (Postgres) ·
Stripe · Google Calendar · Zoom Video SDK · Upstash Redis (ephemeral only) ·
Gemini · Resend · QStash · Sentry

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
  users, credit_packs, bookings, zoom_sessions, payments, audit_log.
- **Redis (Upstash)** is used ONLY for ephemeral state:
  rate limiting (`rl:*`), slot locks (`slot:lock:*`),
  in-session chat (`chat:session:*`), availability cache (`avail:*`).
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
- `BookingService` — orchestrates credits + calendar + Zoom + email + QStash
- `PaymentService` — Stripe checkout, webhook processing, dead-letter recovery
- `SessionService` — Zoom session lifecycle, JWT issuance, in-session chat
- `ChatService` — Gemini AI chat

Route handlers are thin dispatchers: parse input → call service → map errors to HTTP.
Domain errors (`src/domain/errors.ts`) are mapped to HTTP via `src/lib/http-errors.ts`.

## Conventions
- Zod schemas in `src/lib/schemas.ts` — never inline in route handlers.
- Structured logging via `log()` from `src/lib/logger.ts` — no `console.*`.
- User-facing text is Spanish. Error messages go through `friendlyError()`.
- CSRF protection via `isValidOrigin()` on all POST routes (except Stripe webhook + QStash).
- Admin routes gated by `isAdmin()` from `src/lib/admin.ts`.

## Gotchas
- NextAuth v5 is in beta. Session shape: `session.user.email`, `session.user.name`.
- Upstash Redis REST API does NOT support MULTI/EXEC — use Lua via `kv.eval()`.
- Vercel serverless functions cap at 25s (Hobby) / 60s (Pro). SSE uses 24s.
- `setTimeout` does NOT work reliably in serverless — use QStash for delays > 10s.
- Zoom Video SDK != Zoom Meetings API. JWT signing only; no REST for session mgmt.
- `GOOGLE_PRIVATE_KEY` needs `\\n` → `\n` replacement (handled in CalendarClient.ts).
- Supabase TIMESTAMPTZ format differs from JS `toISOString()`:
  - JS: `"2026-04-21T10:04:43.130Z"`
  - PostgREST: `"2026-04-21T10:04:43.13+00:00"`
  **Rule:** always normalize with `new Date(dbTimestamp).toISOString()` before comparing or signing.
- Credit atomicity uses a Postgres stored procedure (`decrement_credit`), not application-side logic.

## Testing
- `npm test` — Jest unit + integration tests
- `npm run test:unit` — unit tests only
- `npm run test:integration` — integration tests only
- `npm run test:e2e` — Playwright end-to-end tests
- Tests for services live in `src/services/__tests__/`
- Tests for infrastructure live alongside: `src/infrastructure/supabase/__tests__/`
- Integration tests in `src/__tests__/integration/`
- Test fixtures (fakes, in-memory repos) in `src/__tests__/fixtures/`
- New business logic requires a service-level test with mock repositories

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build (must pass before PR)
- `npm run lint` — must pass
- `npm test` — all Jest tests
- `npm run test:e2e` — Playwright tests (requires `E2E_BASE_URL`)

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
| Add an admin feature            | `src/app/admin/` + `src/app/api/admin/`         |
| Add a Zod schema                | `src/lib/schemas.ts`                            |
| Change the booking schedule     | `src/lib/booking-config.ts`                     |
| Change email templates          | `src/infrastructure/resend/email-functions.ts`   |
| Add a DB column                 | New file in `supabase/migrations/`              |
| Add a rate limiter              | `src/lib/ratelimit.ts`                          |
| Fix a test fixture              | `src/__tests__/fixtures/`                       |

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
