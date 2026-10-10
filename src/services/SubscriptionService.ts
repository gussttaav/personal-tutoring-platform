import type { ISubscriptionRepository } from "@/domain/repositories/ISubscriptionRepository";
import type {
  BlogArea,
  SubscriptionRecipient,
  SubscriptionStatus,
  SubscriptionType,
} from "@/domain/types";
import { AlreadySubscribedError } from "@/domain/errors";
import { normalizeBlogAreas } from "@/lib/blog/subscription-areas";
import { UserService } from "./UserService";

export class SubscriptionService {
  constructor(
    private readonly subs:        ISubscriptionRepository,
    private readonly userService: UserService,
  ) {}

  // BLOG-15: a blog opt-in carries the areas the reader picked; a selection covering every
  // area (or none sent at all) is stored as `null`, "every area". Courses have no areas.
  async subscribe(email: string, type: SubscriptionType, areas?: BlogArea[]): Promise<void> {
    const userId = await this.userService.ensureUser(email);
    const already = await this.subs.isSubscribed(userId, type);
    if (already) throw new AlreadySubscribedError();
    await this.subs.subscribe(userId, type, type === "blog" ? normalizeBlogAreas(areas) : null);
  }

  async isSubscribed(email: string, type: SubscriptionType): Promise<boolean> {
    const user = await this.userService.findByEmail(email);
    if (!user) return false;
    return this.subs.isSubscribed(user.id, type);
  }

  // BLOG-15: what the notify card needs in one read — whether the reader is subscribed and,
  // for the blog, which areas they follow. Like `isSubscribed`, never creates a user.
  async getStatus(email: string, type: SubscriptionType): Promise<SubscriptionStatus> {
    const user = await this.userService.findByEmail(email);
    if (!user) return { subscribed: false, areas: null };
    const areas = await this.subs.getAreas(user.id, type);
    return areas === undefined
      ? { subscribed: false, areas: null }
      : { subscribed: true, areas };
  }

  // BLOG-15: changes the areas of an EXISTING blog subscription. Returns false when there
  // is none — the card only offers this to a subscriber, so a false here is a stale card
  // (unsubscribed in another tab), and quietly re-subscribing them would be the wrong fix.
  async updateBlogAreas(email: string, areas: BlogArea[]): Promise<boolean> {
    const user = await this.userService.findByEmail(email);
    if (!user) return false;
    return this.subs.updateAreas(user.id, "blog", normalizeBlogAreas(areas));
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
