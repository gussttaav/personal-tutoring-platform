# Phase 3 — Architecture

**Duration:** Week 5–8
**Risk if skipped:** The codebase remains hard to test, hard to migrate, and hard to extend. Not dangerous, but accumulates technical debt.

## Overview

Phase 3 is the structural refactor that prepares the codebase for the database migration in Phase 4. The current code has business logic scattered across route handlers — credit checks happen inside `/api/book`, slot re-checks inside the webhook, Zoom session lookups inside `/api/zoom/token`. This makes the code:

- Hard to unit test (each test needs a Next.js request + response mock)
- Hard to reuse (admin retry in Phase 2 had to awkwardly re-import `processSingleSession` from a route handler)
- Hard to migrate (swapping Redis for Postgres means changing 15+ files instead of 3)

This phase introduces three layers:

- **Domain** — pure types and interfaces, no dependencies
- **Services** — business logic, depends on domain only
- **Infrastructure** — external system adapters (Redis, Stripe, Google, Zoom, Gemini, Resend), implements domain interfaces

Route handlers become thin dispatchers that parse input, call a service method, and format the response.

## Goals

1. Define repository interfaces in the domain layer.
2. Move all Redis access behind repository implementations.
3. Extract business logic from route handlers into services.
4. Reorganize the folder structure to reflect the layered architecture.
5. Preserve all existing behavior — this is a pure refactor.

## Tasks

| ID | Task | Scope | Est. effort |
|----|------|-------|-------------|
| 3.1 | [Define repository interfaces](./01-repository-interfaces.md) | domain layer | 2 h |
| 3.2 | [Implement Redis repository adapters](./02-redis-repositories.md) | infrastructure | 4 h |
| 3.3 | [Extract `CreditService`](./03-credit-service.md) | services | 3 h |
| 3.4 | [Extract `BookingService`](./04-booking-service.md) | services | 6 h |
| 3.5 | [Extract `PaymentService`](./05-payment-service.md) | services | 5 h |
| 3.6 | [Extract `SessionService`](./06-session-service.md) | services | 3 h |
| 3.7 | [Reorganize folder structure](./07-folder-reorg.md) | all files | 2 h |

## Suggested Order

1. **3.1 first** — pure types, unblocks everything else. No behavior change.
2. **3.2** — Redis implementations of those interfaces. Still no behavior change.
3. **3.3, 3.6** in parallel — `CreditService` and `SessionService` have small surface area.
4. **3.4** — `BookingService` is the big one; orchestrates credits, calendar, zoom, email.
5. **3.5** — `PaymentService` builds on `BookingService`; handles webhook consolidation.
6. **3.7 last** — folder reorg. Do it after all services exist so imports settle in one pass.

## Exit Criteria

- [ ] All seven tasks have merged PRs
- [ ] Every route handler is under 80 lines (mostly parsing + service calls)
- [ ] Services can be instantiated with mock repositories in tests
- [ ] No route handler imports `kv` directly — all go through repositories
- [ ] `npm test` passes with new service-level unit tests
- [ ] `npm run build` passes
- [ ] No behavior regressions — the full booking/payment/join flow works end-to-end

## Non-goals for This Phase

- Do **not** introduce a database (Phase 4).
- Do **not** change any public API contract — same URLs, same request/response shapes.
- Do **not** add new features. This is structural only.
- Do **not** rewrite tests — expand coverage where services make it easy, but don't tear down existing Jest tests.

## Testing Strategy

Because services have no Next.js dependency, they can be unit-tested with plain Jest:

```ts
// __tests__/services/CreditService.test.ts
describe("CreditService", () => {
  it("decrements credit atomically", async () => {
    const mockRepo: ICreditsRepository = {
      getCredits: jest.fn().mockResolvedValue({ credits: 1, ... }),
      decrementCredit: jest.fn().mockResolvedValue({ ok: true, remaining: 0 }),
      // ...
    };
    const service = new CreditService(mockRepo);
    const result = await service.useCredit("student@example.com");
    expect(result.ok).toBe(true);
  });
});
```

This is the first time the codebase gets real unit-test ergonomics. Aim for ~70% coverage on the services layer by the end of the phase.

## Risks & Mitigations

**Risk:** Refactor introduces subtle bugs because route handlers are rewritten.
**Mitigation:** Each task preserves existing tests, adds new ones, and includes a manual smoke test in its acceptance criteria.

**Risk:** Large PRs become hard to review.
**Mitigation:** Seven tasks, seven PRs. Each is 200–400 lines of diff.

**Risk:** Import churn from the folder reorg creates merge conflicts with in-flight work.
**Mitigation:** Do 3.7 last, and coordinate — no other PRs in flight when it merges.

## New Folder Structure (Preview)

After Task 3.7, the `src/` directory looks like:

```
src/
├── app/                    # Next.js routes (thin handlers)
├── domain/                 # Types + repository interfaces
├── services/               # Business logic
├── infrastructure/         # External system adapters
│   ├── redis/
│   ├── stripe/
│   ├── google/
│   ├── zoom/
│   ├── gemini/
│   └── email/
├── middleware/             # Cross-cutting concerns
├── components/             # (unchanged)
├── features/               # (unchanged)
├── hooks/                  # (unchanged)
├── constants/              # (unchanged)
└── lib/                    # Shared utilities only (schemas, validation, logger, ip-utils, csrf)
```

See `docs/refactor/PLAN.md` → section **3. Suggested Folder Structure** for the full tree.

## Rollback Plan

Each task is revert-safe because it's a pure refactor. The biggest rollback risk is Task 3.7 (folder reorg) — revert requires resolving import path conflicts. Mitigation: merge 3.7 to main directly (not a long-lived branch) and revert immediately if issues surface. All services implement interfaces that are identical before and after — so an individual service can be reverted without touching the others.
