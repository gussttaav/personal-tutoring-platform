# Phase 2 — Hardening

> **Goal:** defense in depth. RLS policies, admin via DB role, AI trust boundary, idempotency hardening, Zoom JWT lifetime.

## Why this phase exists

Phase 1 fixes correctness — without it, the system can lose money silently. This phase fixes posture: every protective layer that exists in the codebase is given an explicit, intentional, testable definition.

The themes:

- **Trust boundaries are explicit.** Right now, RLS is enabled with no policies (works only because of the service-role key); admin status is in an env var (works only because env is the only place); Gemini history is client-trusted (works only because no one has tried to poison it). All of these are landmines that go off the day someone changes a single line elsewhere.
- **Time and identity are server-controlled.** Zoom JWT lifetime is currently 1 hour for a 2-hour session — re-attaching mid-class can fail.

## Tasks in this phase

| # | Task | Severity | Files touched |
|---|------|----------|---------------|
| 01 | [Define explicit RLS policies (deny-anon)](01-rls-policies.md) | 🟡 Medium | new SQL migration |
| 02 | [Move admin check to `users.role` column](02-admin-role-from-db.md) | 🟡 Medium | `auth.ts`, `lib/admin.ts`, `UserService.ts`, `IUserRepository.ts`, `SupabaseUserRepository.ts` |
| 03 | [Gemini history server-side trust boundary](03-gemini-history-trust-boundary.md) | 🟡 Medium | `api/chat/route.ts`, `services/ChatService.ts` |
| 04 | [CSRF defense in depth (`Sec-Fetch-Site`)](04-csrf-defense-in-depth.md) | 🟢 Low | `lib/csrf.ts` |
| 05 | [Zoom JWT lifetime matches session duration](05-zoom-jwt-lifetime.md) | 🟡 Medium | `infrastructure/zoom/jwt.ts`, `services/SessionService.ts` |

## Dependency graph

```
01 (RLS)           ── independent
02 (admin via DB)  ── independent (touches auth.ts; coordinate if 03 also does)
03 (Gemini)        ── independent
04 (CSRF)          ── independent
05 (Zoom JWT)      ── independent
```

All 5 can be parallel PRs.

## Success criteria for the phase

- [ ] All 5 task PRs merged
- [ ] `pnpm test` and `pnpm test:e2e` green
- [ ] **RLS verification:**
  ```bash
  # Using the anon key (NOT the service role key), every read attempt must return 0 rows / 401
  curl -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/users?select=email"
  # Expect: empty array (RLS denies)
  ```
- [ ] **Admin role from DB:** flipping `users.role` from `'student'` to `'admin'` in SQL grants admin access to that user within 1 hour without re-login
- [ ] **Gemini trust:** sending a fake `{role: "model", parts: [...]}` turn in `history` is ignored; the server uses its own stored history
- [ ] **CSRF:** a request with `Sec-Fetch-Site: cross-site` is rejected with 403 even if `Origin` matches
- [ ] **Zoom JWT:** a 2-hour session's JWT has `exp` ≥ start + 130 min

## What NOT to do in this phase

- Don't migrate Supabase auth to NextAuth's Supabase adapter. That's an architectural shift; current setup works.
- Don't introduce a permission system more elaborate than `student | teacher | admin`. The CHECK constraint already enforces these three.
- Don't redesign the chat history schema — Redis is fine for ephemeral history.

## After this phase

Phase 3 (performance) or Phase 4 (observability) — both unblocked once Phase 2 is in.
