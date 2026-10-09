/**
 * BLOG-01: JSON-LD structured data for a blog post (schema.org/BlogPosting).
 *
 * Server component — the <script> ships in the prerendered HTML so crawlers see it
 * without executing JS (JSON-LD is inert, no CSP concern). Mirrors ./CourseStructuredData.tsx,
 * which mirrors the SEO-04 pattern in ./StructuredData.tsx.
 *
 * Everything is sourced from the build-time content registry (the `Post` frontmatter),
 * never hand-maintained. The author reuses the site's Person identity by `@id`
 * (`${BASE}/#person`), inlined here because a post page does not render the home page's
 * Person node.
 *
 * `datePublished` / `dateModified` are the raw frontmatter calendar days. schema.org
 * accepts a bare `YYYY-MM-DD`, and emitting one avoids inventing a publication *time*
 * (and a timezone) that the content never claimed.
 */

import { localeUrl } from "@/lib/hreflang";
import type { Post } from "@/domain/types";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gustavoai.dev";

export default function ArticleStructuredData({
  post,
  locale,
}: {
  post: Post;
  locale: string;
}) {
  const url = localeUrl(`/blog/${post.slug}`, locale);

  const json = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#post`,
    headline: post.title,
    description: post.summary,
    url,
    inLanguage: locale,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    isAccessibleForFree: true,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: {
      "@type": "Person",
      "@id": `${BASE}/#person`,
      name: "Gustavo Torres",
      url: BASE,
    },
    publisher: {
      "@type": "Person",
      "@id": `${BASE}/#person`,
      name: "Gustavo Torres",
      url: BASE,
    },
    // BLOG-13: the post's areas lead its keywords (a broad subject like "bases-de-datos"
    // moved from `tags` to `areas` when the two-level taxonomy landed).
    ...(post.areas.length + post.tags.length > 0
      ? { keywords: [...post.areas, ...post.tags].join(", ") }
      : null),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
