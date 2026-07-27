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
 */

import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { Course, Lesson, LessonRef } from "@/domain/types";
import type { HeadingOutline } from "@/lib/courses/headings";
import LessonSidebar from "./LessonSidebar";
import OnThisPage from "./OnThisPage";
import LessonNav from "./LessonNav";
import MobileLessonBar from "./MobileLessonBar";

interface LessonLayoutProps {
  course:      Course;
  lessons:     Lesson[];
  courseSlug:  string;
  currentSlug: string;
  title:       string;
  minutes:     number;
  headings:    HeadingOutline[];
  prev:        LessonRef | null;
  next:        LessonRef | null;
  locale:      string;
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
  prev,
  next,
  locale,
  children,
}: LessonLayoutProps) {
  const t = await getTranslations({ locale, namespace: "courses.reader" });
  const sidebarProps = { course, lessons, courseSlug, currentSlug, locale };

  return (
    <>
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

            <LessonNav courseSlug={courseSlug} prev={prev} next={next} locale={locale} />
          </article>
        </div>

        <aside className="lesson-onthispage">
          <OnThisPage headings={headings} />
        </aside>
      </div>
    </>
  );
}
