/*
 * COURSE-P5-00 — Which outline entry is the reader actually in?
 *
 * Extracted from `OnThisPage.tsx` so it can be unit-tested: the repo has no jsdom/RTL,
 * so component markup is not tested, and pure logic pulled out of a component is.
 *
 * The rule the previous version got wrong: **above the first heading, NO entry is
 * current.** It used to fall back to `headings[0]`, so a lesson whose opening prose
 * carries no heading — which is every lesson in this course, since motivación and
 * intuición are deliberately untitled (docs/courses/AUTHORING.md §1) — lit up its
 * first section from the very top of the page. The rail then disagreed with where the
 * reader was for the first few screens, which is worse than highlighting nothing:
 * a progress indicator that is confidently wrong is not a progress indicator.
 *
 * Returning `null` for the introduction is the honest answer. The reader is in the
 * lesson, but not yet in any of its sections.
 */

/** A rendered heading and its current distance from the top of the viewport. */
export interface HeadingPosition {
  id: string;
  /** `getBoundingClientRect().top` — negative once scrolled past. */
  top: number;
}

/**
 * The last heading whose top has crossed the reading line, or `null` when none has —
 * i.e. while the reader is still above the first heading.
 *
 * `positions` must be in document order; the scan stops at the first heading that has
 * not crossed yet, which is what makes it O(1) in practice on a long lesson.
 */
export function activeHeadingId(positions: HeadingPosition[], offset: number): string | null {
  let active: string | null = null;
  for (const { id, top } of positions) {
    if (top - offset <= 0) active = id;
    else break;
  }
  return active;
}
