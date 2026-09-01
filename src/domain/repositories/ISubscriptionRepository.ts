import type { SubscriptionRecipient, SubscriptionType } from "../types";

export interface ISubscriptionRepository {
  subscribe(userId: string, type: SubscriptionType): Promise<void>;
  isSubscribed(userId: string, type: SubscriptionType): Promise<boolean>;

  /** COURSE-P6-02: removes the subscription. Idempotent — removing one that is not there
   *  is a no-op, not an error, so an unsubscribe link is safe to click twice. */
  unsubscribe(userId: string, type: SubscriptionType): Promise<void>;

  /** COURSE-P6-02: every subscriber of `type`, resolved with the email and locale a
   *  background send needs. Read by the admin announce route only. */
  listByType(type: SubscriptionType): Promise<SubscriptionRecipient[]>;
}
