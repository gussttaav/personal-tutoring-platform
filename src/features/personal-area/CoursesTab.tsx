"use client";

/*
 * CoursesTab — enrolled courses, formerly MyCoursesPanel (COURSE-P4-03).
 *
 * The fetch moved up into usePersonalAreaData so the tab strip can show a count
 * badge before the tab is ever opened; this component is now presentational.
 *
 * The EMPTY state remains the important one. Most people who open the personal
 * area are booking students who have never opened a course, so this is the
 * cross-sell surface between the two halves of the site: it renders an invitation
 * to /cursos, never a blank box. Only a failed or untracked fetch renders nothing.
 *
 * No "Mis cursos" heading here on purpose — the tab button already carries that
 * label, and e2e/courses-progress.spec.ts matches it with `exact: true`.
 */

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import CourseProgressCard from "./CourseProgressCard";
import type { EnrollmentsState } from "./types";

export default function CoursesTab({ state }: { state: EnrollmentsState }) {
  const t = useTranslations("areaPersonal.courses");

  // Loading renders nothing rather than a skeleton: a placeholder that resolves to
  // "hidden" would shift the pane for no gain.
  if (state === "loading" || state === "hidden") return null;

  if (state.length === 0) {
    return (
      <div className="pa-invite">
        <div className="pa-invite__tx">
          <h3>{t("emptyTitle")}</h3>
          <p>{t("emptyBody")}</p>
        </div>
        <Link href="/cursos" className="pa-btn pa-btn--primary">
          {t("emptyCta")}
          <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="pa-courses">
      {state.map((view) => (
        <CourseProgressCard key={view.courseSlug} view={view} />
      ))}
    </div>
  );
}
