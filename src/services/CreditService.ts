// ARCH-12: Application service for credit operations.
// Consolidates previously-scattered calls to kv.ts into a single layer.
// Routes call methods here instead of repository functions directly so that
// cross-cutting concerns (audit logging, domain events) live in one place.
// REFACTOR-R4-P1-04: restoreCreditToPack (saga compensation, exact pack) and recordRestore
// (the audit entry for a restore done inside the cancel_booking RPC).
import type { ICreditsRepository, CreditResult } from "@/domain/repositories/ICreditsRepository";
import type { PackSize } from "@/domain/types";
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
    /** ISO 8601 redeemability deadline, resolved by the caller from the
     *  admin-editable pack-validity setting. */
    expiresAt:       string;
  }): Promise<void> {
    await this.credits.addCredits({
      email:           params.email,
      name:            params.name,
      creditsToAdd:    params.amount,
      packLabel:       params.packLabel,
      stripeSessionId: params.stripeSessionId,
      expiresAt:       params.expiresAt,
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
  async useCredit(email: string): Promise<{ remaining: number; packSize: PackSize | null; packId: string | null }> {
    const result = await this.credits.decrementCredit(email);
    if (!result.ok) throw new InsufficientCreditsError();

    await this.audit.append(email, {
      action:    "decrement",
      remaining: result.remaining,
    });

    // REFACTOR-P3-03: surface the decremented pack's size so callers (BookingService)
    // don't need a separate getBalance roundtrip.
    // BOOKING-PACKLINK-01: surface the pack id too, so BookingService can link the
    // booking to it via bookings.credit_pack_id.
    return { remaining: result.remaining, packSize: result.packSize, packId: result.packId };
  }

  async hasProcessedPayment(stripeSessionId: string): Promise<boolean> {
    return this.credits.hasProcessedPayment(stripeSessionId);
  }

  // REFACTOR-P3-05: thin pass-through to the repository broadcast.
  async broadcastPaymentConfirmed(
    paymentIntentId: string,
    payload: { credits: number; name: string; packSize: number },
  ): Promise<void> {
    return this.credits.broadcastPaymentConfirmed(paymentIntentId, payload);
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

  // REFACTOR-R4-P1-04: the booking saga's compensation — give the credit back to the exact
  // pack it just decremented. Returns false (and audits nothing) if that pack is full or
  // expired, so the caller can surface the lost credit instead of reporting success.
  async restoreCreditToPack(email: string, packId: string): Promise<boolean> {
    const restored = await this.credits.restoreCreditToPack(packId);
    if (restored) {
      await this.audit.append(email, { action: "restore", packId });
    }
    return restored;
  }

  // REFACTOR-R4-P1-04: a cancellation restores the credit inside the cancel_booking RPC,
  // which can't write the audit log — this appends the same "restore" entry
  // restoreCredit always has, plus the pack the credit went to.
  async recordRestore(email: string, details: { credits: number; packId: string | null }): Promise<void> {
    await this.audit.append(email, {
      action:  "restore",
      credits: details.credits,
      packId:  details.packId,
    });
  }
}
