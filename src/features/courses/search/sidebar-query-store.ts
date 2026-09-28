/*
 * COURSE-P9-02 — The desktop sidebar's search query, kept across lesson navigation.
 *
 * Module-level for the same reason the index cache in useSearchIndex.ts is: everything under
 * `[lessonSlug]/page.tsx` — providers, sidebar, the field itself — is remounted on every lesson
 * navigation, so component state cannot carry the query across a result click. This is what
 * lets the results stay in the rail while the reader jumps between them.
 *
 * Survives client-side navigation and back/forward; NOT a hard reload, which is accepted — a
 * fresh page load starting from the lesson list is the least surprising outcome.
 *
 * Rejected: sessionStorage (needs a post-hydration read, so the list would paint before the
 * results on every navigation); a `?q=` search param (pollutes static, indexable lesson URLs);
 * a `[courseSlug]/layout.tsx` hosting the sidebar (large, and moves `currentSlug` resolution to
 * the client).
 *
 * Only event handlers write here, so the server-side Map is always empty and a hard load renders
 * an empty field on both sides — no hydration mismatch. The `window` guard documents that
 * invariant rather than relying on it.
 */

const queries = new Map<string, string>();

export function sidebarQueryKey(courseSlug: string, locale: string): string {
  return `${courseSlug}:${locale}`;
}

export function readSidebarQuery(key: string): string {
  if (typeof window === "undefined") return "";
  return queries.get(key) ?? "";
}

export function writeSidebarQuery(key: string, query: string): void {
  if (query === "") queries.delete(key);
  else queries.set(key, query);
}
