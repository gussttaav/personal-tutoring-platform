// ARCH-11 — Redis-backed implementation of ICreditsRepository.
// Wraps src/lib/kv.ts. Once all callers migrate through CreditService (Task 3.3),
// kv.ts can be deleted and its logic inlined here.
import type { ICreditsRepository, CreditResult } from "@/domain/repositories/ICreditsRepository";
import * as kvModule from "./credits-store";

export class RedisCreditsRepository implements ICreditsRepository {
  async getCredits(email: string): Promise<CreditResult | null> {
    return kvModule.getCredits(email);
  }

  async addCredits(params: {
    email:           string;
    name:            string;
    creditsToAdd:    number;
    packLabel:       string;
    stripeSessionId: string;
  }): Promise<void> {
    return kvModule.addOrUpdateStudent(
      params.email,
      params.name,
      params.creditsToAdd,
      params.packLabel,
      params.stripeSessionId,
    );
  }

  async decrementCredit(email: string): Promise<{ ok: boolean; remaining: number }> {
    return kvModule.decrementCredit(email);
  }

  async restoreCredit(email: string): Promise<{ ok: boolean; credits: number }> {
    return kvModule.restoreCredit(email);
  }
}
