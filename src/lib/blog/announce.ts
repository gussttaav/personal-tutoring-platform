/*
 * BLOG-15 — the two rules a blog announcement shares between the service that sends it,
 * the email template that renders it and the admin form that previews it. Pure.
 */

/** Idempotency key in `audit_log.details.announcementKey`. A post is announced ONCE: unlike
 *  a course `update`, there is no second announcement of the same article. */
export function blogAnnouncementKey(slug: string): string {
  return `post:${slug}`;
}

/** The language a reader reads the post in: theirs when the post is published in it, else
 *  the first one it is published in. A Spanish-only post sends an English reader to the
 *  Spanish page, and the email says so. */
export function postReadLocale(
  readerLocale: "es" | "en",
  postLocales:  readonly ("es" | "en")[],
): "es" | "en" {
  return postLocales.includes(readerLocale) ? readerLocale : (postLocales[0] ?? "es");
}
