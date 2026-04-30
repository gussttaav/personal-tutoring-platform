# GUSTAVOAI.DEV

Personal tutoring platform for booking programming, mathematics and AI classes.

> **Live site:** [gustavoai.dev](https://gustavoai.dev)

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-payments-635BFF?logo=stripe&logoColor=white)
![Zoom](https://img.shields.io/badge/Zoom-Video_SDK-2D8CFF?logo=zoom&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-deployed-black?logo=vercel&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-22c55e)

---

## Overview

Full-stack booking platform for online tutoring sessions. Students can schedule individual sessions or purchase class packs, pay securely inside the app, join live virtual classrooms embedded in the platform, and manage all their bookings from a personal dashboard. An AI assistant powered by Gemini answers questions about services, pricing, and scheduling around the clock.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **Next.js 14** (App Router) | Full-stack framework; RSC for static sections, client components only where interactivity is needed |
| **TypeScript** (strict) | End-to-end type safety |
| **NextAuth v5** | Google OAuth authentication |
| **Supabase** (Postgres) | Source of truth for all persistent data: users, bookings, credit packs, payments, audit log |
| **Stripe** | Integrated payment forms (single sessions and packs); webhook processing for payment confirmation |
| **Google Calendar API** | Reads real-time availability; creates and deletes calendar events on booking/cancellation |
| **Zoom Video SDK** | Embedded virtual classroom inside the platform; no external app or install required |
| **Upstash Redis** | Ephemeral state only: rate limiting, slot locking, availability cache, in-session chat state |
| **QStash** | Scheduled background jobs: automatically closes sessions after their duration + grace period |
| **Gemini API** | AI assistant trained on full service details, pricing, and cancellation policy |
| **Resend** | Transactional email: booking confirmations, cancellation notices, reschedule links |
| **Sentry** | Error tracking and monitoring in production |
| **Jest** | Unit and integration tests |
| **Playwright** | End-to-end tests |
| **GitHub Actions** | CI: runs the full test suite automatically on every push |
| **Vercel** | Deployment and hosting |

---

## Features

- **Free intro session** — 15-minute no-cost meeting to define a plan, no commitment required
- **Individual sessions** — 1h and 2h paid sessions; payment handled inside the app via an integrated Stripe form
- **Class packs** — buy 5 or 10 classes at a discount; credits are activated immediately after payment and last 6 months
- **Real-time availability** — weekly calendar fetches free slots from Google Calendar on demand; slots are soft-locked during checkout to prevent double-booking
- **Embedded virtual classroom** — sessions run in a Zoom-powered room inside the platform; no install, no redirect
- **Personal dashboard** — students see all their upcoming and past sessions and can join, reschedule, or cancel from one place
- **Email notifications** — every booking triggers a confirmation email with calendar link, join link, and one-click reschedule/cancel links
- **AI assistant** — Gemini chat widget answers questions about services, pricing, cancellation policy, and Gustavo's background without the student needing to send an email
- **Automatic session closing** — QStash schedules a job at booking time to close the virtual room after the session duration + grace period
- **Google OAuth** — sign-in required before booking; session is verified server-side on all API routes

---

## Architecture

The codebase follows a strict layered architecture. Route handlers are thin dispatchers; all business logic lives in the service layer.

```
src/
├── app/            Route handlers — parse input, call service, format response
├── domain/         Pure types, interfaces, domain errors (zero external deps)
├── services/       Business logic — orchestrates repositories and infrastructure
├── infrastructure/ External adapters — Supabase, Stripe, Google, Zoom, Resend, Redis
├── lib/            Shared utilities — schemas, validation, logger, rate limiting
├── components/     Reusable React components
├── features/       Feature-scoped page components
├── hooks/          React hooks
└── constants/      Static configuration and design tokens
```

**Data flow:**
```
Route handler → Service → Repository interface → Supabase implementation
                                              └→ In-memory implementation (tests)
```

**Key design decisions:**

- **Repository pattern** — all data access goes through interfaces in `src/domain/repositories/`. Services receive repositories via constructor injection, making them fully testable with in-memory fakes without mocking.
- **Redis is ephemeral only** — Supabase is the single source of truth for all persistent data. Redis handles rate limiting keys, slot locks, and short-lived availability cache. Nothing in Redis matters after a page refresh.
- **Credit atomicity** — pack credit decrements use a Postgres stored procedure (`decrement_credit`) to prevent race conditions under concurrent requests.
- **Thin route handlers** — handlers parse and validate input with Zod, call one service method, and map domain errors to HTTP responses via a central error-mapping utility. No business logic in routes.
- **Serverless-safe scheduling** — `setTimeout` is unreliable in serverless functions. All delayed operations (session auto-close) use QStash, which delivers a webhook after the specified delay with signature verification.

---

## Security

Security is treated as a first-class concern throughout the codebase:

- **Authentication** — Google OAuth via NextAuth v5. Session is verified server-side on every API route; no URL parameter trust.
- **CSRF protection** — all state-mutating POST routes validate the `Origin` header via `isValidOrigin()`. Exceptions are Stripe webhooks and QStash callbacks, which use their own signature verification.
- **Webhook signature verification** — Stripe and QStash webhooks are verified with their respective HMAC signatures before any processing occurs.
- **Input validation** — all external input (request bodies, query params) is validated with Zod schemas defined in `src/lib/schemas.ts`. Inline validation in route handlers is not permitted.
- **Tamper-proof action tokens** — cancellation and reschedule links in emails use HMAC-SHA256 signed tokens. Tokens are single-use and expire, preventing replay attacks.
- **Rate limiting** — sliding-window rate limits (Upstash Redis) protect chat, availability, checkout, and credit endpoints against abuse.
- **Admin routes** — protected by a server-side `isAdmin()` check independent of the student auth flow.
- **No sensitive data in Redis** — all persistent student and payment data lives in Supabase (Postgres), not in the cache layer.
- **Stripe payment security** — card data is handled entirely by Stripe's embedded Elements; no card numbers touch the application server.
- **Error tracking** — Sentry captures and alerts on unhandled exceptions in production without exposing stack traces to the client.

---

## Testing & CI

```bash
npm test                # all Jest tests (unit + integration)
npm run test:unit       # unit tests only
npm run test:integration # integration tests only
npm run test:e2e        # Playwright end-to-end tests (requires E2E_BASE_URL)
```

- **Unit tests** — service logic tested with in-memory repository fakes; no real network calls.
- **Integration tests** — cover API route behaviour end-to-end within the Next.js request cycle.
- **E2E tests** — Playwright tests cover the full booking and payment flows in a real browser.
- **GitHub Actions** — the full Jest suite runs automatically on every push and pull request.

---

## Local Setup

### Prerequisites

- Node.js 18+
- [Supabase](https://supabase.com) project (free tier is sufficient)
- [Upstash](https://console.upstash.com) Redis database (free tier is sufficient)
- [Stripe](https://stripe.com) account with products and prices created
- Google Cloud project with **Google Calendar API** enabled and a service account
- [Zoom](https://developers.zoom.us) app with Video SDK credentials
- [QStash](https://upstash.com/qstash) account
- [Resend](https://resend.com) account
- [Sentry](https://sentry.io) project (optional for local dev)

### 1. Clone and install

```bash
git clone https://github.com/gussttaav/personal-web-booking-app.git
cd personal-web-booking-app
npm install
```

### 2. Environment variables

Create `.env.local` in the project root:

```env
# ── Auth ──────────────────────────────────────────────────────────────
AUTH_SECRET=                        # openssl rand -hex 32
AUTH_GOOGLE_ID=                     # Google OAuth client ID
AUTH_GOOGLE_SECRET=                 # Google OAuth client secret

# ── Supabase ──────────────────────────────────────────────────────────
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ── Stripe ────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PACK5=price_...
STRIPE_PRICE_ID_PACK10=price_...
STRIPE_PRICE_ID_SESSION_1H=price_...
STRIPE_PRICE_ID_SESSION_2H=price_...

# ── Upstash Redis (rate limiting + availability cache) ────────────────
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# ── Google Calendar (service account) ─────────────────────────────────
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=your.email@gmail.com

# ── Zoom Video SDK ─────────────────────────────────────────────────────
ZOOM_SDK_KEY=
ZOOM_SDK_SECRET=

# ── QStash (background jobs) ──────────────────────────────────────────
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# ── AI assistant ──────────────────────────────────────────────────────
GEMINI_API_KEY=

# ── Resend (transactional email) ──────────────────────────────────────
RESEND_API_KEY=re_...
RESEND_FROM=Gustavo Torres <contacto@gustavoai.dev>
NOTIFY_EMAIL=your.email@gmail.com

# ── Cancellation / Rescheduling tokens ───────────────────────────────
CANCEL_SECRET=               # openssl rand -hex 32

# ── Sentry ────────────────────────────────────────────────────────────
SENTRY_DSN=

# ── App ───────────────────────────────────────────────────────────────
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. Run in development

```bash
npm run dev
# http://localhost:3000
```

### 4. Test Stripe webhooks locally

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copy the whsec_... shown and set it as STRIPE_WEBHOOK_SECRET
```

---

## Deployment

The project is deployed on Vercel. Set all environment variables from `.env.local` in the Vercel project settings.

**Stripe webhook (production)**

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://gustavoai.dev/api/stripe/webhook`
3. Events: `checkout.session.completed`, `charge.refunded`
4. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` in Vercel

**Google Cloud**

1. Enable **Google Calendar API** in your project
2. Create a **Service Account** → copy `client_email` and `private_key`
3. In Google Calendar → your calendar → Settings → Share with specific people → add the service account email with **"Make changes to events"** permission
4. Set `GOOGLE_CALENDAR_ID` to your Gmail address

**Database**

Run migrations after deploying schema changes:

```bash
supabase db push
# or apply migration files in supabase/migrations/ via the Supabase dashboard
```

---

## License

MIT — see [LICENSE](LICENSE).

---

## Contact

**Gustavo Torres Guerrero**  
[gustavoai.dev](https://gustavoai.dev) · [LinkedIn](https://www.linkedin.com/in/gustavo-torres-guerrero) · [GitHub](https://github.com/gussttaav) · contacto@gustavoai.dev
