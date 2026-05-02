import type { ISubscriptionRepository } from "@/domain/repositories/ISubscriptionRepository";
import type { SubscriptionType } from "@/domain/types";
import { AlreadySubscribedError } from "@/domain/errors";

export class SubscriptionService {
  constructor(private readonly subs: ISubscriptionRepository) {}

  async subscribe(email: string, type: SubscriptionType): Promise<void> {
    const already = await this.subs.isSubscribed(email, type);
    if (already) throw new AlreadySubscribedError();
    await this.subs.subscribe(email, type);
  }

  async isSubscribed(email: string, type: SubscriptionType): Promise<boolean> {
    return this.subs.isSubscribed(email, type);
  }
}
