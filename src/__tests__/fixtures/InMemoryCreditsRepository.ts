// TEST-01: In-memory implementation of ICreditsRepository for integration tests.
// REFACTOR-R4-P1-02: `getCreditsShouldFail` (FakeCalendarClient style) simulates a DB
// read error, so tests can assert the account-deletion gate fails closed.
// REFACTOR-R4-P1-04: restoreCreditToPack, plus fixture-only packIdOf / setExpiresAt that
// InMemoryBookingRepository.cancelByToken and the expired-pack tests use.
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
  // REFACTOR-R4-P1-02
  getCreditsShouldFail = false;

  async getCredits(email: string): Promise<CreditResult | null> {
    if (this.getCreditsShouldFail) throw new Error("InMemoryCreditsRepository: simulated read failure");
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
    expiresAt:       string;
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
      existing.expiresAt       = params.expiresAt;
      existing.lastUpdated     = now;
      existing.stripeSessionId = params.stripeSessionId;
    } else {
      this.store.set(key, {
        email:           params.email,
        name:            params.name,
        credits:         params.creditsToAdd,
        packLabel:       params.packLabel,
        packSize:        params.creditsToAdd as number,
        expiresAt:       params.expiresAt,
        lastUpdated:     now,
        stripeSessionId: params.stripeSessionId,
      });
    }
  }

  async decrementCredit(email: string): Promise<DecrementResult> {
    const key = email.toLowerCase();
    const rec = this.store.get(key);
    if (!rec || rec.credits <= 0) return { ok: false, remaining: 0, packSize: null, packId: null };
    rec.credits -= 1;
    rec.lastUpdated = new Date().toISOString();
    // REFACTOR-P3-03: surface the pack size, mirroring the SQL function.
    // BOOKING-PACKLINK-01: and a stable synthetic pack id (this fake keeps one
    // pack per email) so callers can assert the credit_pack_id linkage.
    return { ok: true, remaining: rec.credits, packSize: rec.packSize as PackSize | null, packId: `pack-${key}` };
  }

  async restoreCredit(email: string): Promise<{ ok: boolean; credits: number }> {
    const rec = this.store.get(email.toLowerCase());
    if (!rec) return { ok: false, credits: 0 };
    rec.credits += 1;
    rec.lastUpdated = new Date().toISOString();
    return { ok: true, credits: rec.credits };
  }

  // REFACTOR-R4-P1-04: mirrors restore_credit_to_pack's expiry check (an expired pack gets
  // nothing back). Like restoreCredit above there is no pack_size cap: this fake's
  // packSize is the first purchase's size, and tests top a user up more than once.
  async restoreCreditToPack(packId: string): Promise<boolean> {
    const rec = packId.startsWith("pack-") ? this.store.get(packId.slice("pack-".length)) : undefined;
    if (!rec || new Date(rec.expiresAt).getTime() <= Date.now()) return false;
    rec.credits += 1;
    rec.lastUpdated = new Date().toISOString();
    return true;
  }

  /** REFACTOR-R4-P1-04 (fixture-only): the synthetic id of the user's one pack, or null. */
  packIdOf(email: string): string | null {
    const key = email.toLowerCase();
    return this.store.has(key) ? `pack-${key}` : null;
  }

  /** REFACTOR-R4-P1-04 (fixture-only): lets a test expire the user's pack after booking. */
  setExpiresAt(email: string, expiresAt: string): void {
    const rec = this.store.get(email.toLowerCase());
    if (rec) rec.expiresAt = expiresAt;
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
