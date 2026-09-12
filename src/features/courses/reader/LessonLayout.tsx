/*
 * COURSE-P1-04 — Lesson reader shell.
 *
 * Server Component that arranges the three regions. Responsive shape lives in
 * `lesson.css` (grid + breakpoints), not here — this file only names the regions:
 *
 *   ≥1280px : sidebar 280 │ content (max 72ch) │ on-this-page 240
 *   768–1279: sidebar 280 │ content            (right rail hidden)
 *   <768px  : content only; sidebar in the drawer; sticky compact top bar
 *
 * The sidebar is rendered TWICE — a `desktop` variant in the static `<aside>` and a
 * `drawer` variant inside `MobileLessonBar` — with `display:none` hiding whichever
 * the viewport doesn't use, so exactly one is in the accessibility tree. The lesson
 * title is rendered here as the page `<h1>`; lesson bodies use h2/h3 for sections.
 *
 * COURSE-P4-02: this is also where `CourseProgressProvider` mounts. It has to be
 * here rather than in `page.tsx` — this is the only shared parent of the two sidebar
 * instances, the mobile bar and the MDX body, and every one of them has a progress
 * leaf inside it. The page itself stays untouched and therefore stays static.
 *
 * COURSE-P9-01: `CourseSearchProvider` mounts here for the same reason — one index, one
 * dialog. COURSE-P9-02: the dialog is now reached only from the icon trigger in
 * `MobileLessonBar`; desktop search is the inline `SidebarSearch` field, which
 * `LessonSidebar` mounts for its desktop variant only (so it exists once, although the
 * sidebar is rendered twice).
 *
 * COURSE-P10-01: `LessonCta` closes the article, after prev/next. See its own header
 * for why it sits there and why it is a link rather than a dispatched event.
 *
 * CONTENT-FEEDBACK-01: `ContentFeedback` (👍/👎 · share · report) sits right after the
 * body, before "Para profundizar" — the first thing after the last paragraph is the
 * question about it. It is keyed by `contentLocale`, the locale of the prose actually
 * served, so a fallback lesson read from /en/ is judged (and shared) as Spanish.
 */

import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { Course, Lesson, LessonRef, ReadingItem } from "@/domain/types";
import type { HeadingOutline } from "@/lib/courses/headings";
import LessonSidebar from "./LessonSidebar";
import OnThisPage from "./OnThisPage";
import LessonNav from "./LessonNav";
import MobileLessonBar from "./MobileLessonBar";
import CourseProgressProvider from "./CourseProgressProvider";
import CourseSearchProvider from "@/features/courses/search/CourseSearchProvider";
import CodeCopyButtons from "@/features/content/CodeCopyButtons";
import ContentFeedback from "@/features/content/ContentFeedback";
import { lessonContentKey } from "@/lib/content/content-key";
import { localeUrl } from "@/lib/hreflang";
import type { ContentLocale } from "@/domain/types";
import LessonComplete from "./LessonComplete";
import LessonReading from "./LessonReading";
import LessonCta from "./LessonCta";

interface LessonLayoutProps {
  course:      Course;
  lessons:     Lesson[];
  courseSlug:  string;
  currentSlug: string;
  title:       string;
  minutes:     number;
  headings:    HeadingOutline[];
  /** COURSE-P4-04: quiz + challenge ids placed in this lesson's body, for the
   *  solved counter next to mark-complete. Empty on a lesson with no exercises. */
  exerciseIds: string[];
  /** COURSE-P8-01: "Para profundizar" entries. Empty renders nothing. */
  reading:     ReadingItem[];
  prev:        LessonRef | null;
  next:        LessonRef | null;
  locale:      string;
  /** CONTENT-FEEDBACK-01: locale of the prose actually served (`view.contentLocale`),
   *  which differs from `locale` on an untranslated fallback lesson. */
  contentLocale: string;
  /** COURSE-P9-01: content hash of the search index, for the client's `?v=` cache buster. */
  searchVersion: string;
  children:    ReactNode; // rendered MDX body
}

export default async function LessonLayout({
  course,
  lessons,
  courseSlug,
  currentSlug,
  title,
  minutes,
  headings,
  exerciseIds,
  reading,
  prev,
  next,
  locale,
  contentLocale,
  searchVersion,
  children,
}: LessonLayoutProps) {
  const t = await getTranslations({ locale, namespace: "courses.reader" });
  const sidebarProps = { course, lessons, courseSlug, currentSlug, locale };

  return (
    <CourseProgressProvider courseSlug={courseSlug} lessonSlug={currentSlug}>
      <CourseSearchProvider
        courseSlug={courseSlug}
        version={searchVersion}
        locale={locale}
        lessonCount={lessons.length}
      >
      <MobileLessonBar title={title}>
        <LessonSidebar {...sidebarProps} variant="drawer" />
      </MobileLessonBar>

      <div className="lesson-shell">
        <aside className="lesson-sidebar-desktop">
          <LessonSidebar {...sidebarProps} variant="desktop" />
        </aside>

        <div className="lesson-main">
          <article className="lesson-content">
            <header style={{ marginBottom: "2rem" }}>
              <h1
                style={{
                  fontFamily: "var(--font-headline, Manrope), sans-serif",
                  fontSize: "clamp(1.75rem, 4vw, 2.4rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.15,
                  color: "var(--text)",
                  margin: "0 0 8px",
                }}
              >
                {title}
              </h1>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-dim)" }}>
                {t("readingTime", { minutes })}
              </p>
            </header>

            {children}

            {/* COURSE-P12: hover-reveal copy buttons on the body's fenced code blocks.
                Mounted as a direct child of `.lesson-content` so it scopes its search to
                the lesson body and never reaches the reading/footer chrome below. */}
            <CodeCopyButtons />

            <ContentFeedback
              contentType="lesson"
              contentKey={lessonContentKey(courseSlug, currentSlug)}
              locale={contentLocale as ContentLocale}
              shareUrl={localeUrl(`/cursos/${courseSlug}/${currentSlug}`, contentLocale)}
              shareTitle={title}
            />

            {/* COURSE-P8-01: between the body and mark-complete. The bridge stays the
                lesson's last prose; this joins the footer chrome below it. */}
            <LessonReading reading={reading} locale={locale} />

            <LessonComplete lessonSlug={currentSlug} exerciseIds={exerciseIds} />

            <LessonNav courseSlug={courseSlug} prev={prev} next={next} locale={locale} />

            {/* COURSE-P10-01: after prev/next, deliberately. Mark-complete → next lesson
                is the study loop; an offer placed inside it buys attention by interrupting
                the thing the reader came for. */}
            <LessonCta locale={locale} />
          </article>
        </div>

        <aside className="lesson-onthispage">
          <OnThisPage headings={headings} />
        </aside>
      </div>
      </CourseSearchProvider>
    </CourseProgressProvider>
  );
}
