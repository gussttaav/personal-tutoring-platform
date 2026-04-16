# Task 3.3 — Extract `CreditService`

**Fix ID:** `ARCH-12`
**Priority:** P2
**Est. effort:** 3 hours

## Problem

Credit operations are scattered:
- `/api/credits/route.ts` calls `getCredits(email)` directly
- `/api/book/route.ts` calls `decrementCredit(email)` and `restoreCredit(email)`
- `/api/cancel/route.ts` calls `restoreCredit(email)`
- `/api/stripe/webhook/route.ts` calls `addOrUpdateStudent(...)` via `handlePackPayment`

Each call site duplicates audit-log writes and logging. If business rules change (e.g., "credits restored should also send an email"), we have to edit every call site.

This task introduces `CreditService` as the single entry point for credit operations. Route handlers call the service; the service orchestrates the repository + audit log + domain events.

## Scope

**Create:**
- `src/services/CreditService.ts`
- `src/services/index.ts` — exports singleton instances
- `src/services/__tests__/CreditService.test.ts`

**Modify:**
- `src/app/api/credits/route.ts` — use `CreditService` instead of `getCredits`
- `src/app/api/book/route.ts` — use `CreditService` for decrement + restore
- `src/app/api/cancel/route.ts` — use `CreditService` for restore
- `src/app/api/stripe/webhook/route.ts` — use `CreditService` for pack credits

**Do not touch:**
- `src/lib/kv.ts` — it still works; the repository wraps it
- Any UI component

## Approach

### Step 1 — Service class

```ts
// src/services/CreditService.ts
/**
 * ARCH-12 — Application service for credit operations.
 *
 * Consolidates previously-scattered calls to kv.ts into a single layer.
 * Routes should call methods here instead of repository functions directly,
 * because this layer is where we add cross-cutting concerns (audit logging,
 * domain events, email notifications on low balance, etc.) without spreading
 * them across route handlers.
 */
import type { ICreditsRepository, CreditResult }
  from "@/domain/repositories/ICreditsRepository";
import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import { InsufficientCreditsError } from "@/domain/errors";
import { log } from "@/lib/logger";

export class CreditService {
  constructor(
    private readonly credits: ICreditsRepository,
    private readonly audit:   IAuditRepository,
  ) {}

  async getBalance(email: string): Promise<CreditResult | null> {
    return this.credits.getCredits(email);
  }

  async addCredits(params: {
    email:           string;
    name:            string;
    amount:          number;
    packLabel:       string;
    stripeSessionId: string;
  }): Promise<void> {
    await this.credits.addCredits({
      email:           params.email,
      name:            params.name,
      creditsToAdd:    params.amount,
      packLabel:       params.packLabel,
      stripeSessionId: params.stripeSessionId,
    });

    await this.audit.append(params.email, {
      action:          "purchase",
      creditsAdded:    params.amount,
      packLabel:       params.packLabel,
      stripeSessionId: params.stripeSessionId,
    });

    log("info", "Credits added", { service: "CreditService", email: params.email, amount: params.amount });
  }

  /**
   * Atomically uses one credit. Throws InsufficientCreditsError if the user
   * has no credits, the pack is expired, or the user doesn't exist.
   */
  async useCredit(email: string): Promise<{ remaining: number }> {
    const result = await this.credits.decrementCredit(email);
    if (!result.ok) throw new InsufficientCreditsError();

    await this.audit.append(email, {
      action:     "decrement",
      remaining:  result.remaining,
    });

    return { remaining: result.remaining };
  }

  async restoreCredit(email: string): Promise<{ credits: number }> {
    const result = await this.credits.restoreCredit(email);
    // Note: restoreCredit returns ok=false if no active pack; we silently
    // succeed with credits=0 — the caller (cancel flow) doesn't care whether
    // a restore happened, only that no error occurred.
    if (result.ok) {
      await this.audit.append(email, {
        action:  "restore",
        credits: result.credits,
      });
    }
    return { credits: result.credits };
  }
}
```

### Step 2 — Singleton export

```ts
// src/services/index.ts
import { CreditService } from "./CreditService";
import { creditsRepository, auditRepository } from "@/infrastructure/redis";

export const creditService = new CreditService(creditsRepository, auditRepository);
```

### Step 3 — Migrate route handlers

**`/api/credits/route.ts`:**

```ts
// Before:
import { getCredits } from "@/lib/kv";
// ...
const result = await getCredits(email);

// After:
import { creditService } from "@/services";
// ...
const result = await creditService.getBalance(email);
```

**`/api/book/route.ts`:**

```ts
// Before:
import { decrementCredit, getCredits } from "@/lib/kv";
// ...
const credit = await decrementCredit(email);
if (!credit.ok) {
  return NextResponse.json({ error: "Sin créditos disponibles" }, { status: 400 });
}

// After:
import { creditService } from "@/services";
import { InsufficientCreditsError } from "@/domain/errors";
// ...
try {
  await creditService.useCredit(email);
} catch (err) {
  if (err instanceof InsufficientCreditsError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  throw err;
}
```

Similar changes for `/api/cancel/route.ts` (restoreCredit) and `/api/stripe/webhook/route.ts` (addCredits in the pack handler).

## Acceptance Criteria

- [ ] `CreditService` exists with methods: `getBalance`, `addCredits`, `useCredit`, `restoreCredit`
- [ ] `useCredit` throws `InsufficientCreditsError` on failure
- [ ] Audit logging happens inside the service — call sites no longer call `appendAuditLog` directly
- [ ] Singleton exported from `src/services/index.ts`
- [ ] All four route handlers use the service instead of direct `kv.ts` calls
- [ ] Unit tests with mock repositories — at least: useCredit success, useCredit insufficient throws error, addCredits writes audit entry
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] Manual test: full booking + cancellation flow works as before
- [ ] Fix-ID comments added

## Reference

See `docs/refactor/PLAN.md` → section **3. Suggested Folder Structure** and **5. Migration Plan**.

## Testing

Unit tests now become easy because the service takes its dependencies via constructor:

```ts
// src/services/__tests__/CreditService.test.ts
import { CreditService } from "../CreditService";
import type { ICreditsRepository } from "@/domain/repositories/ICreditsRepository";
import type { IAuditRepository } from "@/domain/repositories/IAuditRepository";
import { InsufficientCreditsError } from "@/domain/errors";

const mockCredits = (): jest.Mocked<ICreditsRepository> => ({
  getCredits:      jest.fn(),
  addCredits:      jest.fn(),
  decrementCredit: jest.fn(),
  restoreCredit:   jest.fn(),
});

const mockAudit = (): jest.Mocked<IAuditRepository> => ({
  append: jest.fn(),
  list:   jest.fn(),
});

describe("CreditService", () => {
  it("throws InsufficientCreditsError when decrement fails", async () => {
    const credits = mockCredits();
    const audit   = mockAudit();
    credits.decrementCredit.mockResolvedValue({ ok: false, remaining: 0 });

    const service = new CreditService(credits, audit);

    await expect(service.useCredit("a@b.com"))
      .rejects.toThrow(InsufficientCreditsError);
    expect(audit.append).not.toHaveBeenCalled();
  });

  it("appends audit entry on successful decrement", async () => {
    const credits = mockCredits();
    const audit   = mockAudit();
    credits.decrementCredit.mockResolvedValue({ ok: true, remaining: 4 });

    const service = new CreditService(credits, audit);
    const result = await service.useCredit("a@b.com");

    expect(result).toEqual({ remaining: 4 });
    expect(audit.append).toHaveBeenCalledWith("a@b.com", expect.objectContaining({
      action: "decrement",
      remaining: 4,
    }));
  });
});
```

## Out of Scope

- Moving webhook dedup logic here (Task 3.5)
- Changing any credit business rule
- Removing `kv.ts` (stays until Phase 4)

## Rollback

Route handlers can individually revert to direct `kv.ts` calls if needed — the old functions are still exported. Low risk.
