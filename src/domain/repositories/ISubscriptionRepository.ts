import type { BlogArea, SubscriptionRecipient, SubscriptionType } from "../types";

export interface ISubscriptionRepository {
  /** BLOG-15: `areas` is the blog selection (`null` = every area); omitted or `null` for
   *  courses. The caller normalizes it (`normalizeBlogAreas`). */
  subscribe(userId: string, type: SubscriptionType, areas?: BlogArea[] | null): Promise<void>;
  isSubscribed(userId: string, type: SubscriptionType): Promise<boolean>;

  /** BLOG-15: the stored area selection — `undefined` when the user is NOT subscribed,
   *  `null` for every area. Throws on a read error (fail closed). */
  getAreas(userId: string, type: SubscriptionType): Promise<BlogArea[] | null | undefined>;

  /** BLOG-15: replaces the area selection of an existing subscription. Returns whether a
   *  subscription row was there to update — it never creates one. */
  updateAreas(userId: string, type: SubscriptionType, areas: BlogArea[] | null): Promise<boolean>;

  /** COURSE-P6-02: removes the subscription. Idempotent — removing one that is not there
   *  is a no-op, not an error, so an unsubscribe link is safe to click twice. */
  unsubscribe(userId: string, type: SubscriptionType): Promise<void>;

  /** COURSE-P6-02: every subscriber of `type`, resolved with the email and locale a
   *  background send needs (BLOG-15: and the blog areas they follow). Read by the admin
   *  announce routes only. */
  listByType(type: SubscriptionType): Promise<SubscriptionRecipient[]>;
}
