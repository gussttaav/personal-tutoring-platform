// ARCH-12: Application service for credit operations.
// Consolidates previously-scattered calls to kv.ts into a single layer.
// Routes call methods here instead of repository functions directly so that
// cross-cutting concerns (audit logging, domain events) live in one place.
import type { ICreditsRepository, CreditResult } from "@/domain/repositories/ICreditsRepository";
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

    log("info", "Credits added", {
      service: "CreditService",
      email:   params.email,
      amount:  params.amount,
    });
  }

  // Atomically uses one credit. Throws InsufficientCreditsError if the user
  // has no credits, the pack is expired, or the user doesn't exist.
  async useCredit(email: string): Promise<{ remaining: number }> {
    const result = await this.credits.decrementCredit(email);
    if (!result.ok) throw new InsufficientCreditsError();

    await this.audit.append(email, {
      action:    "decrement",
      remaining: result.remaining,
    });

    return { remaining: result.remaining };
  }

  async restoreCredit(email: string): Promise<{ credits: number }> {
    const result = await this.credits.restoreCredit(email);
    // ok=false means no active pack; silently succeed with credits=0
    // so the cancel flow doesn't care whether a restore happened
    if (result.ok) {
      await this.audit.append(email, {
        action:  "restore",
        credits: result.credits,
      });
    }
    return { credits: result.credits };
  }
}
