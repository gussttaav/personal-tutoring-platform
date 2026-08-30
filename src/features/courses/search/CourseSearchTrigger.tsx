"use client";

/*
 * COURSE-P9-01 — The button that opens search.
 *
 * Two variants because the two places it appears want different things: `bar` is the
 * full-width field-looking control at the top of the desktop sidebar rail and on the
 * landing/catalog pages; `icon` is the 36px button in the mobile sticky bar, matched to
 * the drawer toggle already sitting beside it.
 */

import { useTranslations } from "next-intl";
import { useCourseSearch } from "./CourseSearchProvider";

interface CourseSearchTriggerProps {
  variant?: "bar" | "icon";
  className?: string;
}

export default function CourseSearchTrigger({
  variant = "bar",
  className,
}: CourseSearchTriggerProps) {
  const t = useTranslations("courses.search");
  const { openSearch, open } = useCourseSearch();
  const label = t("trigger");

  return (
    <button
      type="button"
      onClick={openSearch}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={variant === "icon" ? label : undefined}
      className={[
        "cs-trigger",
        variant === "icon" ? "cs-trigger--icon" : "",
        className ?? "",
      ].filter(Boolean).join(" ")}
    >
      <span className="material-symbols-outlined" aria-hidden="true">search</span>
      {variant === "bar" ? <span className="cs-trigger-label">{label}</span> : null}
    </button>
  );
}
