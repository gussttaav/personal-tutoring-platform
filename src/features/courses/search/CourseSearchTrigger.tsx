"use client";

/*
 * COURSE-P9-01 — The button that opens the search dialog.
 *
 * COURSE-P9-02: the mobile bar's 36px icon button is the ONLY trigger left. The desktop
 * `bar` variant — a full-width field-looking button at the top of the sidebar rail — was
 * replaced by the inline `SidebarSearch` field, so the dialog is a mobile surface now.
 * Matched to the drawer toggle sitting beside it in `MobileLessonBar`.
 */

import { useTranslations } from "next-intl";
import { useCourseSearch } from "./CourseSearchProvider";

export default function CourseSearchTrigger() {
  const t = useTranslations("courses.search");
  const { openSearch, open } = useCourseSearch();

  return (
    <button
      type="button"
      onClick={openSearch}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={t("trigger")}
      className="cs-trigger cs-trigger--icon"
    >
      <span className="material-symbols-outlined" aria-hidden="true">search</span>
    </button>
  );
}
