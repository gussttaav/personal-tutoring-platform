"use client";

/*
 * landing-refinements — the catalog card's progress-aware resume block.
 *
 * The card itself is a Server Component; this small client leaf is the only part that depends on
 * the reader. It mirrors the landing hero's split (server `CourseHero` + client
 * `CourseHeroActions`): progress is per-user and resolves only after hydration — the catalog is
 * statically generated and readable signed-out, so `useCourseProgress` fetches `/api/courses/
 * progress` (signed-out = 204 = untracked).
 *
 * COEXIST, not replace (unlike the landing hero): the card always shows "Ver curso" → the landing
 * page (server-rendered, the whole-card cover link). This leaf only ADDS, when the reader has
 * progress, a bar + "Continuar donde lo dejaste" that deep-links to their last lesson, skipping the
 * landing. Until progress resolves — and for new/anonymous readers — it renders nothing, so the
 * card is simply "Ver curso".
 *
 * `contentLocale` is the locale the LESSONS live in — passed to <Link locale=…> so a lesson href
 * crosses locales on purpose rather than 404ing under /en. See CourseHeroActions for the rationale.
 */

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCourseProgress } from "@/hooks/useCourseProgress";

interface CourseCardActionsProps {
  courseSlug: string;
  courseTitle: string;
  /** Locale the lessons live in. Omit when it equals the page's. */
  contentLocale?: string;
}

export default function CourseCardActions({
  courseSlug,
  courseTitle,
  contentLocale,
}: CourseCardActionsProps) {
  const tp = useTranslations("courses.progress");
  // No `lessonSlug`: the catalog is not a lesson view — this only reads progress, records nothing.
  const p = useCourseProgress({ courseSlug });

  const resuming = p.tracking && p.lastSeenLessonSlug !== null;
  if (!resuming) return null;

  return (
    <div className="course-card__resume">
      <span className="course-card__resume-label">
        {tp("lessonsDone", { done: p.completedLessons, total: p.totalLessons })}
      </span>
      <div className="course-card__bar" aria-hidden="true">
        <span style={{ width: `${p.percentComplete}%` }} />
      </div>
      <Link
        href={`/cursos/${courseSlug}/${p.lastSeenLessonSlug}`}
        locale={contentLocale}
        className="course-card__continue"
        aria-label={`${tp("resume")} — ${courseTitle}`}
      >
        {tp("resume")}
        <span className="material-symbols-outlined arrow" style={{ fontSize: "1.1rem" }} aria-hidden="true">
          arrow_forward
        </span>
      </Link>
    </div>
  );
}
