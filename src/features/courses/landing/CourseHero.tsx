/*
 * COURSE-P1-03 / landing-refinements — Course landing hero.
 *
 * Server Component. Leads with the course title/tagline. The old "what you'll build" box was
 * removed in the editorial redesign — the tagline already carries that promise — and the
 * per-course `outcome` field is gone with it. The title is set in the display serif, with the
 * part after the first colon in italic (an editorial accent that degrades to plain text for a
 * title without a colon). A per-course decorative `heroMotif` (manifest-selected) sits faintly
 * behind it; `HeroMotif` renders nothing when the field is absent.
 *
 * The call to action is the client `CourseHeroActions`: it shows the RESUME card for a reader
 * with progress and the START button otherwise (or "soon" until the first lesson ships) — see
 * that file for why the decision is client-side and why "replace" beats "coexist".
 *
 * COURSE-P6-03: `contentLocale` is the locale the LESSONS live in, which differs from the page
 * locale while a course is translated only at the manifest level. It is threaded into every
 * lesson href (via next-intl's <Link locale=…>) so the link crosses locales deliberately rather
 * than 404ing under /en — the prefixed URL flips the NEXT_LOCALE cookie and lands on the correct
 * canonical page. (See git history of this file for the full routing rationale.)
 */

import { getTranslations } from "next-intl/server";
import type { Course } from "@/domain/types";
import CourseHeroActions from "./CourseHeroActions";
import HeroMotif from "@/features/courses/HeroMotif";

interface CourseHeroProps {
  course: Course;
  lessonCount: number;
  firstLessonSlug: string | null;
  locale: string;
  /** Locale the lessons live in. Omit when it always equals `locale`. */
  contentLocale?: string;
}

export default async function CourseHero({
  course,
  lessonCount,
  firstLessonSlug,
  locale,
  contentLocale,
}: CourseHeroProps) {
  const t = await getTranslations({ locale, namespace: "courses.landing.hero" });

  // Editorial accent: everything after the first ": " is set in italic on its own line.
  // A title without a colon renders whole, in roman — `titleTail` is empty and no <br> shows.
  const [titleHead, ...titleRest] = course.title.split(": ");
  const titleTail = titleRest.join(": ");

  return (
    <section style={{ position: "relative", paddingTop: "48px", paddingBottom: "8px" }}>
      {/* Decorative, manifest-selected motif — faint, behind the title, no meaning. */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          right: "0",
          pointerEvents: "none",
        }}
      >
        <HeroMotif kind={course.heroMotif} size={360} opacity={0.08} />
      </div>

      <div style={{ position: "relative", maxWidth: "680px" }}>
        <h1
          className="lp-serif"
          style={{
            fontSize: "clamp(2.25rem, 5.5vw, 3.75rem)",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            color: "var(--text)",
            margin: 0,
          }}
        >
          {titleHead}
          {titleTail ? ":" : ""}
          {titleTail ? (
            <>
              <br />
              <span style={{ fontStyle: "italic", color: "var(--green)" }}>{titleTail}</span>
            </>
          ) : null}
        </h1>

        <p
          style={{
            marginTop: "24px",
            maxWidth: "600px",
            fontSize: "clamp(1.0625rem, 2.2vw, 1.25rem)",
            lineHeight: 1.6,
            color: "var(--text-muted)",
          }}
        >
          {course.tagline}
        </p>

        {/* Meta row */}
        <div
          style={{
            marginTop: "26px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "12px",
            fontFamily: "var(--font-headline, Manrope), sans-serif",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--text-dim)",
          }}
        >
          <span>
            {t("levelLabel")}:{" "}
            <strong style={{ color: "var(--text-muted)", fontWeight: 600 }}>{course.level}</strong>
          </span>
          {lessonCount > 0 ? (
            <>
              <span aria-hidden="true" style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--border-variant)" }} />
              <span>{t("lessons", { count: lessonCount })}</span>
            </>
          ) : null}
        </div>

        <CourseHeroActions
          courseSlug={course.slug}
          firstLessonSlug={firstLessonSlug}
          contentLocale={contentLocale}
        />
      </div>
    </section>
  );
}
