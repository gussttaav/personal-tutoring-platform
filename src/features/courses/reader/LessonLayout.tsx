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
 * COURSE-P9-01: `CourseSearchProvider` mounts here for the same reason — it owns one
 * dialog shared by the desktop and mobile triggers. The DESKTOP trigger is rendered here,
 * in the `<aside>` above `LessonSidebar`, and the mobile one in `MobileLessonBar`; neither
 * goes inside `LessonSidebar`, which is rendered twice and would duplicate it.
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
import CourseSearchTrigger from "@/features/courses/search/CourseSearchTrigger";
import LessonComplete from "./LessonComplete";
import LessonReading from "./LessonReading";

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
          {/* 16px here + the sidebar nav's own 8px top padding = a 24px gap, matching the
              24px the back-link already leaves beneath itself. At 0 the search field sat
              almost flush against the course title. */}
          <div style={{ padding: "8px 4px 16px" }}>
            <CourseSearchTrigger />
          </div>
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

            {/* COURSE-P8-01: between the body and mark-complete. The bridge stays the
                lesson's last prose; this joins the footer chrome below it. */}
            <LessonReading reading={reading} locale={locale} />

            <LessonComplete lessonSlug={currentSlug} exerciseIds={exerciseIds} />

            <LessonNav courseSlug={courseSlug} prev={prev} next={next} locale={locale} />
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
