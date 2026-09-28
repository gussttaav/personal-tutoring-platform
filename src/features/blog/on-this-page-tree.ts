/*
 * BLOG — shape the flat heading list into the collapsible "On this page" rail.
 *
 * Extracted from `OnThisPage.tsx` for the same reason as `scroll-spy.ts`: the repo has
 * no jsdom, so component markup is not tested and pure logic pulled out of a component
 * is. Two functions:
 *
 *   groupHeadings   — flat h2/h3 list → one group per h2, its h3s nested under it.
 *   activeGroupIndex — given the scroll-spy's active id, which group the reader is in.
 *
 * The rail then renders every group's h2 always, and a group's h3s only while that
 * group is the active one (so exactly one section is expanded at a time, or none while
 * the reader is still above the first heading).
 */

import type { HeadingOutline } from "@/lib/courses/headings";

export interface HeadingGroup {
  /** The section heading. `null` for any h3s that appear before the first h2. */
  h2: HeadingOutline | null;
  /** The h3s under this h2, in document order. */
  children: HeadingOutline[];
}

/**
 * Fold the flat outline into groups: each h2 starts a group, each following h3 joins
 * the group above it. h3s before the first h2 (unusual, but valid) land in a leading
 * group with `h2: null`, which the rail renders un-collapsible.
 */
export function groupHeadings(headings: HeadingOutline[]): HeadingGroup[] {
  const groups: HeadingGroup[] = [];

  for (const heading of headings) {
    if (heading.depth === 2) {
      groups.push({ h2: heading, children: [] });
    } else if (groups.length > 0) {
      groups[groups.length - 1].children.push(heading);
    } else {
      groups.push({ h2: null, children: [heading] });
    }
  }

  return groups;
}

/**
 * The index of the group the reader is currently in — the group whose h2 is active, or
 * whose h3 is active. `-1` when nothing is active (the reader is above the first
 * heading) or the active id is not in any group, so every collapsible group closes.
 */
export function activeGroupIndex(groups: HeadingGroup[], activeId: string | null): number {
  if (activeId === null) return -1;
  return groups.findIndex(
    (group) => group.h2?.id === activeId || group.children.some((child) => child.id === activeId),
  );
}
