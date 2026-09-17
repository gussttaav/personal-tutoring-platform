/*
 * REDESIGN-P1-03 — home (/) latest-posts band.
 *
 * Server Component. Reuses `PostCard` untouched and the first two entries of
 * `listPosts(locale)` — the same published-only, newest-first list `/blog` renders — so the
 * home's order can never disagree with the blog index. Only the two-column grid around the
 * cards is new (`.home-posts-grid`, `src/features/home/home.css`).
 *
 * `listPosts` is published-only, so a locale can be empty; renders nothing rather than a
 * section head over an empty grid.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import PostCard from "@/features/blog/PostCard";
import { listPosts } from "@/lib/blog/registry";

interface HomePostsProps {
  locale: string;
}

export default async function HomePosts({ locale }: HomePostsProps) {
  const t = await getTranslations({ locale, namespace: "blog.index" });
  const tHome = await getTranslations({ locale, namespace: "home.blog" });

  const posts = listPosts(locale).slice(0, 2);

  if (posts.length === 0) return null;

  return (
    <section style={{ padding: "24px 0 72px" }}>
      <div className="lp-section-head">
        <span className="lp-kicker">{t("overline")}</span>
        <span className="lp-rule" />
      </div>

      <div className="home-section-title-row">
        <h2
          className="lp-serif"
          style={{
            fontSize: "clamp(1.75rem, 3.6vw, 2.5rem)",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: 1.08,
            color: "var(--text)",
            margin: 0,
          }}
        >
          {tHome.rich("heading", {
            accent: (chunks) => (
              <span style={{ fontStyle: "italic", color: "var(--green)" }}>{chunks}</span>
            ),
          })}
        </h2>
        <Link href="/blog" className="home-see-all">
          {tHome("seeAll")}
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "1.125rem" }}
            aria-hidden="true"
          >
            arrow_forward
          </span>
        </Link>
      </div>

      <div className="home-posts-grid">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} locale={locale} />
        ))}
      </div>
    </section>
  );
}
