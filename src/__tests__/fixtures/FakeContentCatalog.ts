// CONTENT-FEEDBACK-01: In-memory IContentCatalog for service tests.
//
// Declare the published pages up front; anything else resolves to null, exactly
// like a draft or an unknown slug does against the real registries.
import type { IContentCatalog, ResolvedContent } from "@/domain/repositories/IContentCatalog";
import type { ContentLocale, ContentRef } from "@/domain/types";

export interface FakeContentEntry {
  contentType: ContentRef["contentType"];
  contentKey:  string;
  /** Locales the page is published in. */
  locales:     ContentLocale[];
  title?:      string;
}

export class FakeContentCatalog implements IContentCatalog {
  constructor(private readonly entries: FakeContentEntry[] = []) {}

  resolve(ref: ContentRef, locale: ContentLocale): ResolvedContent | null {
    const hit = this.entries.find(
      (e) => e.contentType === ref.contentType && e.contentKey === ref.contentKey && e.locales.includes(locale),
    );
    if (!hit) return null;
    return {
      title:   hit.title ?? hit.contentKey,
      pageUrl: `https://example.test/${locale}/${ref.contentType}/${ref.contentKey}`,
    };
  }
}
