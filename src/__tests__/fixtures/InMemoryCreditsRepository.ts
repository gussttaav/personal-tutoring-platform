// TEST-01: In-memory implementation of ICreditsRepository for integration tests.
import type { ICreditsRepository, DecrementResult } from "@/domain/repositories/ICreditsRepository";
import type { CreditResult, PackSize } from "@/domain/types";

interface CreditsRecord {
  email:           string;
  name:            string;
  credits:         number;
  packLabel:       string;
  packSize:        number | null;
  expiresAt:       string;
  lastUpdated:     string;
  stripeSessionId: string;
}

export class InMemoryCreditsRepository implements ICreditsRepository {
  private store   = new Map<string, CreditsRecord>();
  private usedIds = new Set<string>();

  async getCredits(email: string): Promise<CreditResult | null> {
    const rec = this.store.get(email.toLowerCase());
    if (!rec) return null;
    return {
      credits:         rec.credits,
      name:            rec.name,
      packSize:        rec.packSize as CreditResult["packSize"],
      expiresAt:       rec.expiresAt,
    };
  }

  async addCredits(params: {
    email:           string;
    name:            string;
    creditsToAdd:    number;
    packLabel:       string;
    stripeSessionId: string;
  }): Promise<void> {
    // Idempotent by stripeSessionId
    if (this.usedIds.has(params.stripeSessionId)) return;
    this.usedIds.add(params.stripeSessionId);

    const key      = params.email.toLowerCase();
    const existing = this.store.get(key);
    const now      = new Date().toISOString();

    if (existing) {
      existing.credits        += params.creditsToAdd;
      existing.packLabel       = params.packLabel;
      existing.lastUpdated     = now;
      existing.stripeSessionId = params.stripeSessionId;
    } else {
      this.store.set(key, {
        email:           params.email,
        name:            params.name,
        credits:         params.creditsToAdd,
        packLabel:       params.packLabel,
        packSize:        params.creditsToAdd as number,
        expiresAt:       new Date(Date.now() + 365 * 24 * 60 * 60_000).toISOString(),
        lastUpdated:     now,
        stripeSessionId: params.stripeSessionId,
      });
    }
  }

  async decrementCredit(email: string): Promise<DecrementResult> {
    const rec = this.store.get(email.toLowerCase());
    if (!rec || rec.credits <= 0) return { ok: false, remaining: 0, packSize: null };
    rec.credits -= 1;
    rec.lastUpdated = new Date().toISOString();
    // REFACTOR-P3-03: surface the pack size, mirroring the SQL function
    return { ok: true, remaining: rec.credits, packSize: rec.packSize as PackSize | null };
  }

  async restoreCredit(email: string): Promise<{ ok: boolean; credits: number }> {
    const rec = this.store.get(email.toLowerCase());
    if (!rec) return { ok: false, credits: 0 };
    rec.credits += 1;
    rec.lastUpdated = new Date().toISOString();
    return { ok: true, credits: rec.credits };
  }

  async hasProcessedPayment(stripeSessionId: string): Promise<boolean> {
    return this.usedIds.has(stripeSessionId);
  }

  // REFACTOR-P3-05: no-op in tests — spy on this to assert the broadcast fired.
  async broadcastPaymentConfirmed(
    _paymentIntentId: string,
    _payload: { credits: number; name: string; packSize: number },
  ): Promise<void> {
    // intentionally empty
  }
}
