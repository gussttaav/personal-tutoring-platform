"use client";

/*
 * COURSE-P9-01 — Owns the open state and hosts the one dialog.
 *
 * MOUNTED ONCE PER SURFACE. On the lesson reader that is `LessonLayout`, because it is the
 * only shared parent of both `LessonSidebar` instances and the mobile bar — the same
 * reason `CourseProgressProvider` lives there.
 *
 * COURSE-P9-02: two consumers. The mobile bar's icon trigger opens the dialog hosted here
 * (`open`/`openSearch`/`closeSearch` are mobile-only now); the desktop `SidebarSearch`
 * field reads `courseSlug`/`version`/`locale`/`lessonCount` from this context and renders
 * its results inline. `LessonSidebar` is rendered TWICE (desktop aside + drawer) with CSS
 * hiding one, so the field is mounted by its desktop variant only.
 *
 * Search is scoped to the ONE course the reader is inside — the only surface that offers
 * it. Nothing here knows the name of any particular course, so a second course gets search
 * with no code change.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useHydrated } from "@/hooks/useClientValue";
import CourseSearchDialog from "./CourseSearchDialog";

interface CourseSearchContextValue {
  open:        boolean;
  openSearch:  () => void;
  closeSearch: () => void;
  courseSlug:  string;
  /** Content hash of the index, for the `?v=` cache buster. */
  version:     string;
  locale:      string;
  lessonCount: number;
}

const CourseSearchContext = createContext<CourseSearchContextValue | null>(null);

export function useCourseSearch(): CourseSearchContextValue {
  const ctx = useContext(CourseSearchContext);
  if (!ctx) throw new Error("useCourseSearch must be used inside <CourseSearchProvider>");
  return ctx;
}

interface CourseSearchProviderProps {
  courseSlug:  string;
  /** Content hash of the search index, from `searchIndexVersion()` at build time. */
  version:     string;
  locale:      string;
  /** Lessons searchable here — the placeholder says so instead of being generic. */
  lessonCount: number;
  children:    ReactNode;
}

export default function CourseSearchProvider({
  courseSlug,
  version,
  locale,
  lessonCount,
  children,
}: CourseSearchProviderProps) {
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();

  const openSearch = useCallback(() => setOpen(true), []);
  const closeSearch = useCallback(() => setOpen(false), []);

  const value = useMemo<CourseSearchContextValue>(
    () => ({ open, openSearch, closeSearch, courseSlug, version, locale, lessonCount }),
    [open, openSearch, closeSearch, courseSlug, version, locale, lessonCount],
  );

  return (
    <CourseSearchContext.Provider value={value}>
      {children}
      {/* Portal target only exists after hydration; the dialog is never server-rendered. */}
      {hydrated && open ? <CourseSearchDialog /> : null}
    </CourseSearchContext.Provider>
  );
}
