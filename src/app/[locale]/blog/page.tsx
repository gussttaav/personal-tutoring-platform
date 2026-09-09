/*
 * BLOG-01 — Blog index (/blog).
 *
 * Statically generated for both locales. The list comes from the PUBLISHED-only registry
 * selector, so drafts never appear, and the honest empty state renders rather than a
 * blank page when a locale has nothing yet.
 *
 * Route-scoped CSS is imported HERE, not in the shared layout, so it only loads on this
 * route — the same rule the course routes follow. The `.lp-*` editorial atoms come from
 * the courses feature because they are the site's shared editorial vocabulary (the
 * display serif, the kicker, the hairline rule), not course-specific styling.
 */

import "@/features/courses/course-editorial.css";
import "./blog.css";

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PostCard from "@/features/blog/PostCard";
import BlogNotifyCard from "@/features/blog/BlogNotifyCard";
import { listPosts } from "@/lib/blog/registry";
import { blogLocales } from "@/lib/blog/locales";
import { routing } from "@/i18n/routing";
import { availableLocaleAlternates } from "@/lib/hreflang";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.blog" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: true, follow: true },
    // Advertise only the locales whose index actually has a post, so the sitemap and
    // this page's alternates cannot disagree (the COURSE-P6-03 rule).
    alternates: availableLocaleAlternates("/blog", locale, blogLocales()),
  };
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "blog.index" });

  const posts = listPosts(locale);

  return (
    <>
      <Navbar />
      <main style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            // 840 is the READING measure, the same as the post page, and the whole page
            // is that one column. The course catalog's 1100 is wrong here: its cards are an
            // auto-fill grid that genuinely fills the width, whereas a post list is a single
            // column. Capping the children at 760 inside a 1100 container (as this did) left
            // every element aligned to the left of a container centred on something wider,
            // so the page read as shifted rather than centred.
            maxWidth: 840,
            margin: "0 auto",
            // Top padding clears the fixed 70px navbar so the kicker (the header's first
            // element) isn't hidden under its blur — same figure as the course catalog.
            padding: "96px 20px 80px",
          }}
        >
          {/* Header — kicker + hairline rule + serif display, matching the course pages. */}
          <header style={{ marginBottom: "44px" }}>
            <div className="lp-section-head">
              <span className="lp-kicker">{t("overline")}</span>
              <span className="lp-rule" />
            </div>
            <h1
              className="lp-serif"
              style={{
                fontSize: "clamp(2rem, 5vw, 3.25rem)",
                fontWeight: 500,
                letterSpacing: "-0.02em",
                lineHeight: 1.08,
                color: "var(--text)",
                margin: "0 0 18px",
              }}
            >
              {t.rich("heading", {
                accent: (chunks) => (
                  <span style={{ fontStyle: "italic", color: "var(--green)" }}>{chunks}</span>
                ),
              })}
            </h1>
            <p style={{ maxWidth: "600px", fontSize: "1.0625rem", lineHeight: 1.6, color: "var(--text-muted)", margin: 0 }}>
              {t("subtitle")}
            </p>
          </header>

          {posts.length === 0 ? (
            <div
              style={{
                padding: "48px 32px",
                textAlign: "center",
                background: "var(--surface-low)",
                border: "1px solid var(--border-variant)",
                borderRadius: "20px",
              }}
            >
              <h2
                className="lp-serif"
                style={{
                  fontSize: "1.75rem",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  color: "var(--text)",
                  margin: "0 0 10px",
                }}
              >
                {t("empty.title")}
              </h2>
              <p style={{ maxWidth: "440px", margin: "0 auto", fontSize: "0.9375rem", lineHeight: 1.6, color: "var(--text-muted)" }}>
                {t("empty.body")}
              </p>
            </div>
          ) : (
            <div className="blog-list">
              {posts.map((post) => (
                <PostCard key={post.slug} post={post} locale={locale} />
              ))}
            </div>
          )}

          {/* Opt-in for new posts — the value the ComingSoonModal used to carry, on a
              page that now has something to read first. */}
          <BlogNotifyCard />
        </div>
      </main>
      <Footer />
    </>
  );
}
