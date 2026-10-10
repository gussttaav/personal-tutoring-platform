/*
 * BLOG-15 — which blog areas a subscriber follows, and whether a post reaches them.
 *
 * Pure (constants + types only) so the reader card, the subscription service and the
 * announcement service share ONE rule and a test can pin it without a database.
 *
 * Storage is `subscriptions.areas` (migration 0026): `null` means every area. A selection
 * that covers every area is stored as `null` rather than as the full list, so a reader who
 * ticked everything also hears about an area added later — which is what "all of them"
 * meant when they ticked it.
 */

import { BLOG_AREAS } from "@/constants/blog";
import type { BlogArea } from "@/domain/types";

/** Dedupe, keep only known areas, order as `BLOG_AREAS`; `null` when every area is in. */
export function normalizeBlogAreas(areas: readonly BlogArea[] | null | undefined): BlogArea[] | null {
  if (!areas) return null;
  const picked = BLOG_AREAS.filter((area) => areas.includes(area));
  return picked.length === BLOG_AREAS.length ? null : picked;
}

/** The areas a stored value stands for — `null` expanded to every area. For display. */
export function expandBlogAreas(areas: readonly BlogArea[] | null): BlogArea[] {
  return areas ? BLOG_AREAS.filter((area) => areas.includes(area)) : [...BLOG_AREAS];
}

/** Do two selections stand for the same areas? `null` and the full list are equal, and order
 *  does not matter. BLOG-15: what tells the notify card whether a subscriber's edited
 *  selection is a change worth saving. */
export function sameBlogAreas(
  a: readonly BlogArea[] | null,
  b: readonly BlogArea[] | null,
): boolean {
  return expandBlogAreas(a).join() === expandBlogAreas(b).join();
}

/**
 * Does a post reach this subscriber?
 *   - subscribed to every area (`null`)            → yes
 *   - the post names no area (a general post, e.g.
 *     the blog's own introduction)                  → yes, it concerns every reader
 *   - otherwise                                     → at least one area in common
 */
export function subscriptionMatchesPost(
  subscriberAreas: readonly BlogArea[] | null,
  postAreas:       readonly BlogArea[],
): boolean {
  if (subscriberAreas === null) return true;
  if (postAreas.length === 0) return true;
  return postAreas.some((area) => subscriberAreas.includes(area));
}
