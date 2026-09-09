/*
 * BLOG-01 — blog index card.
 *
 * Server Component (its content ships as HTML). Shows a post's headline metadata —
 * date, reading time, title, summary — in the same editorial voice as the course
 * catalog: the display serif for the title over the shared card surface, with the
 * visual language and hover living in `blog.css`.
 *
 * Unlike `CourseCard`, the whole card IS one <Link>. That card needs the
 * `.card-cover` stretched-link trick because it carries a second, per-user
 * "Continuar" action inside it; a post has exactly one destination, so the simple
 * thing is also the correct one.
 *
 * The date is formatted through next-intl so it reads natively in both locales, and
 * pinned to UTC: `post.date` is a calendar day (`YYYY-MM-DD`), which `new Date()`
 * parses as UTC midnight — rendered in a negative-offset zone without `timeZone`
 * it would show the PREVIOUS day. The machine-readable value in `dateTime` stays
 * the raw frontmatter string.
 */

import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Post } from "@/domain/types";

export default async function PostCard({ post, locale }: { post: Post; locale: string }) {
  const t = await getTranslations({ locale, namespace: "blog.card" });
  const format = await getFormatter({ locale });

  const published = format.dateTime(new Date(`${post.date}T00:00:00Z`), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <Link href={`/blog/${post.slug}`} className="post-card">
      <div className="post-card__meta">
        <time dateTime={post.date}>{published}</time>
        <span className="post-card__dot" aria-hidden="true" />
        <span>{t("readingTime", { minutes: post.minutes })}</span>
      </div>

      <h2 className="post-card__title lp-serif">{post.title}</h2>
      <p className="post-card__summary">{post.summary}</p>

      <span className="post-card__cta">
        {t("cta")}
        <span
          className="material-symbols-outlined arrow"
          style={{ fontSize: "1.125rem" }}
          aria-hidden="true"
        >
          arrow_forward
        </span>
      </span>
    </Link>
  );
}
