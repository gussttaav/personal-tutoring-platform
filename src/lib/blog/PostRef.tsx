/*
 * BLOG-06 — the reference hover card.
 *
 * The blog's counterpart to `<Leccion slug="…">` (src/lib/courses/Leccion.tsx,
 * COURSE-P7-01): a link's target gets a CSS-only hover card built from data the
 * registry already owns. But a post has no cross-lesson slug to author — it has a
 * bibliography. BLOG-02 already requires every in-body citation link to point at the
 * exact URL of a `reading` frontmatter entry ("en el cuerpo, el enlace va sobre la
 * técnica o el año", see the authoring note atop any post with a `reading` list). That
 * convention means the reference is already identified by the link the author wrote —
 * no new tag, no id to invent, no existing post to rewrite. This component only has to
 * notice the match.
 *
 * It overrides `a` for the whole MDX component map (src/lib/blog/mdx.ts), so every
 * in-body link is checked. A link whose href is not in `reading[]` — the Gutenberg
 * ebook citations, say — renders exactly as it would with no override at all: a card
 * is additive, never a requirement on how a post links out.
 *
 * Server-rendered, same reason as `Leccion`: three fields in a `<span>` that CSS shows
 * on hover costs nothing in the post's client bundle.
 */

import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import type { ReadingItem } from "@/domain/types";

export interface PostRefCtx {
  reading: ReadingItem[];
  /** The request locale — drives the card's chrome (kind/lang labels), not matching. */
  locale: string;
}

/** Exact URL match against the post's bibliography. Pure, so the rule is testable
 *  without rendering the (async, request-bound) component around it. */
export function findReference(reading: ReadingItem[], href: string | undefined): ReadingItem | undefined {
  return href ? reading.find((item) => item.url === href) : undefined;
}

/**
 * Bind the `a` override to the post being compiled — same arrangement as
 * `makeLeccion`, and for the same reason: a Server Component in the MDX map cannot
 * reach the post's frontmatter, so `reading` and `locale` are closed over instead.
 */
export function makePostLink(ctx: PostRefCtx) {
  return async function PostLink({ href, children }: { href?: string; children?: ReactNode }) {
    const item = findReference(ctx.reading, href);
    if (!item) return <a href={href}>{children}</a>;

    const t = await getTranslations({ locale: ctx.locale, namespace: "blog.reading" });
    // The source's own language, shown only when it differs from what the reader is
    // reading — the same "say so, don't make them discover it" reasoning as
    // `Leccion`'s `refFallback`.
    const otherLang = item.lang !== ctx.locale;

    return (
      <span className="post-ref-wrap">
        <a href={href} className="post-ref">
          {children}
        </a>
        {/* aria-hidden: the card repeats what the link already says, and reading four
            lines of annotation on focus is worse than not reading them. */}
        <span className="post-ref-card" aria-hidden="true">
          <span className="post-ref-kicker">
            {t(`kind.${item.kind}`)}
            {otherLang ? ` · ${t(`lang.${item.lang}`)}` : ""}
          </span>
          <span className="post-ref-title">{item.title}</span>
          <span className="post-ref-meta">
            {item.authors}
            {item.year ? `, ${item.year}` : ""} · {item.venue}
          </span>
          <span className="post-ref-summary">{item.note}</span>
        </span>
      </span>
    );
  };
}
