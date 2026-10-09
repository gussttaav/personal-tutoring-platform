/*
 * BLOG-01 — Blog index (/blog).
 *
 * Statically generated for both locales. The list comes from the PUBLISHED-only registry
 * selector, so drafts never appear, and the honest empty state renders rather than a
 * blank page when a locale has nothing yet.
 *
 * CSS is imported HERE, not in the shared layout, so it only loads on routes that render
 * a post card. `blog.css` moved to `features/blog/` in REDESIGN-P1-03 once the home's
 * latest-posts band started importing it too — same reasoning as `catalog.css`'s
 * placement next to `CourseCard`. The `.lp-*` editorial atoms come from the courses
 * feature because they are the site's shared editorial vocabulary (the display serif,
 * the kicker, the hairline rule), not course-specific styling.
 *
 * BLOG-13: area + topic filters, a featured newest post and pages. The list is the
 * client island `BlogIndex` (state in the URL, see its header); this page hands it the
 * slim `IndexEntry` projection of every published post and renders the header. The
 * island reads `useSearchParams()`, so it sits in a <Suspense> whose fallback is the
 * same list unfiltered — the prerendered HTML stays the full first page.
 */

import "@/features/courses/course-editorial.css";
import "@/features/blog/blog-taxonomy.css";
import "@/features/blog/blog.css";

import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BlogIndex, { BlogIndexFallback } from "@/features/blog/BlogIndex";
import BlogNotifyCard from "@/features/blog/BlogNotifyCard";
import { toIndexEntries } from "@/features/blog/archive-entries";
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
  const entries = toIndexEntries(posts);

  return (
    <>
      <Navbar />
      <main style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            // 1100 matches the course catalog, now that the list is a 2-column grid
            // (blog.css) instead of the single 840px reading column: the cards genuinely
            // fill this width the same way the catalog's do, so the earlier reasoning for
            // capping this container at the post page's reading measure no longer applies.
            maxWidth: 1100,
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
              className="lp-serif blog-title"
              style={{
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
            <p style={{ fontSize: "1.0625rem", lineHeight: 1.6, color: "var(--text-muted)", margin: 0 }}>
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
            <Suspense fallback={<BlogIndexFallback entries={entries} />}>
              <BlogIndex entries={entries} />
            </Suspense>
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
