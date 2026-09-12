/*
 * CONTENT-FEEDBACK-01 — content identity helpers.
 *
 * A vote or an error report points at a page by (type, key): `lesson` with
 * "<courseSlug>/<lessonSlug>" or `post` with "<postSlug>". This module is the
 * single place that knows the key's shape — the widget builds keys with it, the
 * Zod schema validates with its regex, and the catalog adapter parses them back
 * into registry lookups.
 *
 * ZERO imports on purpose: the widget ships in the blog route's first-load JS
 * (scanned by scripts/check-bundle.ts), so nothing here may reach a registry,
 * the filesystem, or the course feature tree. The registry-backed side lives in
 * ./catalog.ts, which is server-only.
 */

export const CONTENT_TYPES = ["lesson", "post"] as const;
export type ContentTypeName = (typeof CONTENT_TYPES)[number];

/** One or two lowercase kebab segments: "dl-nlp/tokenizacion" | "por-que-empiezo-un-blog". */
export const CONTENT_KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

/** Longest key the DB accepts (CHECK in 0021_content_feedback.sql). */
export const CONTENT_KEY_MAX = 200;

export function lessonContentKey(courseSlug: string, lessonSlug: string): string {
  return `${courseSlug}/${lessonSlug}`;
}

export type ParsedContentKey =
  | { type: "lesson"; courseSlug: string; lessonSlug: string }
  | { type: "post"; slug: string };

/**
 * Splits a key according to its type. `null` when the segment count does not
 * match the type (a lesson needs exactly two, a post exactly one) or the key
 * fails the shape regex — so a caller never has to re-validate.
 */
export function parseContentKey(type: ContentTypeName, key: string): ParsedContentKey | null {
  if (key.length > CONTENT_KEY_MAX || !CONTENT_KEY_RE.test(key)) return null;
  const parts = key.split("/");
  if (type === "lesson") {
    return parts.length === 2 ? { type, courseSlug: parts[0], lessonSlug: parts[1] } : null;
  }
  return parts.length === 1 ? { type, slug: parts[0] } : null;
}

/** Locale-less route of the page: "/cursos/a/b" | "/blog/s". `null` on a bad key. */
export function contentRoute(type: ContentTypeName, key: string): string | null {
  const parsed = parseContentKey(type, key);
  if (!parsed) return null;
  return parsed.type === "lesson"
    ? `/cursos/${parsed.courseSlug}/${parsed.lessonSlug}`
    : `/blog/${parsed.slug}`;
}

/**
 * The dedupe key of a vote. A signed-in reader is his account; an anonymous one
 * is the random id his browser keeps (src/features/content/feedback-storage.ts).
 * Prefixed so the two namespaces can never collide even if an id were forged.
 */
export function voterKey(userId: string | null, clientId: string): string {
  return userId ? `user:${userId}` : `anon:${clientId}`;
}
