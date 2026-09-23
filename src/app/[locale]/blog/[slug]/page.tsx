/*
 * BLOG-01 — Blog post reader (/blog/[slug]).
 *
 * Statically generated for every PUBLISHED post × locale. A draft has no page at all —
 * unlike the course landing (which is deliberately ungated so it can be reviewed on a
 * preview deploy before its lessons ship), a half-written article has nothing to review.
 *
 * Route-scoped CSS is imported HERE, never in the shared layout, so KaTeX's ~23 KB only
 * loads on pages that can render maths.
 *
 * Metadata: `availableLocaleAlternates` emits only the locales the post exists in, so a
 * URL that would 404 is never advertised. Both locales exist for every post today; the
 * moment one ships in Spanish only, this keeps telling the truth without a change here.
 *
 * BLOG-05: the archive pane. Every published post in one column, newest first, as the
 * sticky left track at ≥1024px (`PostArchive`) and as a floating button + drawer below
 * (`PostArchiveMobile`). The mobile island is a SIBLING of <main>, not a child: <main>
 * is a stacking context (z-index: 1) and the fixed Navbar is z-50 beside it, so a
 * drawer inside <main> could never cover the navbar. Both islands get the same slim
 * projection of the post list — never the summaries or reading lists.
 */

import "../_styles/katex.css";
import "./post.css";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ArticleStructuredData from "@/components/seo/ArticleStructuredData";
import CodeCopyButtons from "@/features/content/CodeCopyButtons";
import ContentFeedback from "@/features/content/ContentFeedback";
import OnThisPage from "@/features/blog/OnThisPage";
import PostArchive from "@/features/blog/PostArchive";
import PostArchiveMobile from "@/features/blog/PostArchiveMobile";
import PostReading from "@/features/blog/PostReading";
import PostToc from "@/features/blog/PostToc";
import { toArchiveEntries } from "@/features/blog/archive-entries";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { availableLocaleAlternates, localeUrl } from "@/lib/hreflang";
import { extractHeadings } from "@/lib/courses/headings";
import { getPost, listPosts, postNeighbours } from "@/lib/blog/registry";
import { postLocales } from "@/lib/blog/locales";
import { getPostSource } from "@/lib/blog/post-source";
import { renderPost } from "@/lib/blog/mdx";
import type { ContentLocale } from "@/domain/types";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    listPosts(locale).map((post) => ({ locale, slug: post.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = getPost(slug, locale);
  if (!post || post.draft) return {};

  const route = `/blog/${post.slug}`;
  // SEO-03: locale-specific share image — the credential stats are baked into the PNG.
  const ogImage = locale === "en" ? "/og-en.png" : "/og.png";

  return {
    title: `${post.title} — Gustavo Torres`,
    description: post.summary,
    robots: { index: true, follow: true },
    alternates: availableLocaleAlternates(route, locale, postLocales(post.slug)),
    openGraph: {
      type: "article",
      siteName: "gustavoai.dev",
      title: post.title,
      description: post.summary,
      url: localeUrl(route, locale),
      locale: locale === "en" ? "en_US" : "es_ES",
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary,
      images: [ogImage],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const post = getPost(slug, locale);
  if (!post || post.draft) notFound();

  const source = getPostSource(post.slug, locale);
  if (!source) notFound();

  const t = await getTranslations({ locale, namespace: "blog.post" });
  const format = await getFormatter({ locale });
  // BLOG-06: the post's own bibliography, so an in-body link matching a `reading`
  // entry's url gets a hover card — see src/lib/blog/PostRef.tsx.
  const { content } = await renderPost(source, { reading: post.reading, locale });
  const headings = extractHeadings(source);
  const { newer, older } = postNeighbours(post.slug, locale);
  const entries = toArchiveEntries(listPosts(locale));

  // `post.date` is a calendar day, which `new Date()` reads as UTC midnight. Without an
  // explicit UTC timeZone it renders as the PREVIOUS day west of Greenwich.
  const day = (value: string) =>
    format.dateTime(new Date(`${value}T00:00:00Z`), {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

  return (
    <>
      <ArticleStructuredData post={post} locale={locale} />
      <Navbar />
      <main style={{ position: "relative", zIndex: 1 }}>
        <div className="post-shell">
          {/* BLOG-05: desktop left pane; post.css hides it below 1024px. */}
          <aside className="post-archive">
            <PostArchive key={post.slug} entries={entries} currentSlug={post.slug} variant="sidebar" />
          </aside>

          <div className="post-main">
            {/* Hidden at ≥1024px, where the archive pane's header link replaces it. */}
            <Link href="/blog" className="post-back">
              <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }} aria-hidden="true">
                arrow_back
              </span>
              {t("backToIndex")}
            </Link>

            <header className="post-header">
              <h1 className="post-title lp-serif">{post.title}</h1>
              <p className="post-dateline">
                <time dateTime={post.date}>{t("published", { date: day(post.date) })}</time>
                <span className="post-dateline__dot" aria-hidden="true" />
                <span>{t("readingTime", { minutes: post.minutes })}</span>
                {post.updated ? (
                  <>
                    <span className="post-dateline__dot" aria-hidden="true" />
                    <time dateTime={post.updated}>{t("updated", { date: day(post.updated) })}</time>
                  </>
                ) : null}
              </p>
            </header>

            {/* Mobile / tablet outline (reveal-on-scroll-up); the rail below replaces
                it ≥1280px. */}
            <PostToc headings={headings} />

            <article className="post-content">
              {content}
              {/* BLOG-03: hover-reveal copy buttons on fenced code blocks. Mounted as a
                  direct child so it scopes its search to this article's figures. */}
              <CodeCopyButtons />
            </article>

            {/* CONTENT-FEEDBACK-01: 👍/👎 · share · report, right after the article — the
                first thing after the last paragraph is the question about it. */}
            <ContentFeedback
              contentType="post"
              contentKey={post.slug}
              locale={locale as ContentLocale}
              shareUrl={localeUrl(`/blog/${post.slug}`, locale)}
              shareTitle={post.title}
            />

            {/* BLOG-02: outside the article, so the last paragraph of the post stays the
                last thing the reader reads. Renders nothing when `reading` is empty. */}
            <PostReading reading={post.reading} locale={locale} />

            {newer || older ? (
              <nav className="post-nav" aria-label={t("moreLabel")}>
                {older ? (
                  <Link href={`/blog/${older.slug}`} className="post-nav__link">
                    <span className="post-nav__kicker">{t("older")}</span>
                    <span className="post-nav__title">{older.title}</span>
                  </Link>
                ) : (
                  <span />
                )}
                {newer ? (
                  <Link href={`/blog/${newer.slug}`} className="post-nav__link post-nav__link--end">
                    <span className="post-nav__kicker">{t("newer")}</span>
                    <span className="post-nav__title">{newer.title}</span>
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </div>

          {/* Desktop right rail; post.css hides it below 1280px. */}
          <aside className="post-onthispage">
            <OnThisPage headings={headings} />
          </aside>
        </div>
      </main>

      {/* BLOG-05: floating button + drawer, outside <main> on purpose (see header). */}
      <PostArchiveMobile key={post.slug} entries={entries} currentSlug={post.slug} />

      <Footer />
    </>
  );
}
