/*
 * CONTENT-FEEDBACK-01 — the content-existence port for feedback.
 *
 * `ContentFeedbackService` needs one fact before it stores a vote or a report:
 * does this (type, key) name a page that is published in this locale — and, if
 * so, what is it called and where does it live, for the admin list and the
 * notification email. Both registries (courses, blog) are memoized synchronous
 * filesystem reads, so — exactly like `ICourseCatalog` — this is injected rather
 * than imported, keeping the service free of I/O and letting its tests declare a
 * catalog in three lines.
 *
 * Sync on purpose, same reasoning as ICourseCatalog. Not an `I*Repository`
 * despite living here — `IConfigCache` and `ICourseCatalog` set that precedent.
 */
import type { ContentLocale, ContentRef } from "../types";

export interface ResolvedContent {
  title:   string;
  /** Absolute canonical URL of the page in `locale`, via `localeUrl`. */
  pageUrl: string;
}

export interface IContentCatalog {
  /**
   * `null` for an unknown type/key, a draft, or a locale the content is not
   * published in. Lessons are checked per locale — the widget sends the locale of
   * the prose actually served, so an untranslated lesson read from `/en/…` arrives
   * as "es" and resolves; "en" for that same lesson does not.
   */
  resolve(ref: ContentRef, locale: ContentLocale): ResolvedContent | null;
}
