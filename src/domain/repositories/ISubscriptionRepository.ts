import type { SubscriptionType } from "../types";

export interface ISubscriptionRepository {
  subscribe(email: string, type: SubscriptionType): Promise<void>;
  isSubscribed(email: string, type: SubscriptionType): Promise<boolean>;
}
