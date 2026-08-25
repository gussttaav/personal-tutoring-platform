import type { ISubscriptionRepository } from "@/domain/repositories/ISubscriptionRepository";
import type { SubscriptionRecipient, SubscriptionType } from "@/domain/types";
import { AlreadySubscribedError } from "@/domain/errors";
import { UserService } from "./UserService";

export class SubscriptionService {
  constructor(
    private readonly subs:        ISubscriptionRepository,
    private readonly userService: UserService,
  ) {}

  async subscribe(email: string, type: SubscriptionType): Promise<void> {
    const userId = await this.userService.ensureUser(email);
    const already = await this.subs.isSubscribed(userId, type);
    if (already) throw new AlreadySubscribedError();
    await this.subs.subscribe(userId, type);
  }

  async isSubscribed(email: string, type: SubscriptionType): Promise<boolean> {
    const user = await this.userService.findByEmail(email);
    if (!user) return false;
    return this.subs.isSubscribed(user.id, type);
  }

  // COURSE-P6-02: the counterpart of `subscribe`, and the mechanism behind both the
  // notify card's toggle and the unsubscribe link in the announce email. Unlike
  // `subscribe` it does NOT throw when there is nothing to remove: an unsubscribe that
  // finds no row has still achieved what the caller asked for. A user who never existed
  // is the same no-op — no `ensureUser` here, because unsubscribing must not create rows.
  async unsubscribe(email: string, type: SubscriptionType): Promise<void> {
    const user = await this.userService.findByEmail(email);
    if (!user) return;
    await this.subs.unsubscribe(user.id, type);
  }

  // COURSE-P6-02: admin-only, for the announce route. Not exposed to customers.
  async listSubscribers(type: SubscriptionType): Promise<SubscriptionRecipient[]> {
    return this.subs.listByType(type);
  }
}
