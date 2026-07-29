"use client";

/*
 * COURSE-P4-03 — "Mis cursos" in /area-personal.
 *
 * Mounted as a sibling of the session cards, so its fetch starts alongside the
 * bookings fetch instead of waterfalling behind it — the page already makes several
 * requests and this one is cheap.
 *
 * The EMPTY state is the important one. Most people who open the personal area are
 * booking students who have never opened a course, so this is the cross-sell surface
 * between the two halves of the site: it renders an invitation to /cursos, never a
 * blank box. Only a failed or untracked fetch renders nothing at all — progress must
 * never be the reason a student cannot see their booked sessions.
 *
 * Plain `fetch`, not `@/lib/api-client`: `request<T>` calls `res.json()`
 * unconditionally and this endpoint answers 204 when the session is gone (see
 * useCourseProgress, same reasoning).
 */

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { EnrolledCourseView } from "@/domain/types";
import type { EnrollmentsState } from "./types";
import CourseProgressCard from "./CourseProgressCard";

// ─── Empty state: the invitation ──────────────────────────────────────────────

function CoursesInvitation() {
  const t = useTranslations("areaPersonal.courses");
  return (
    <div
      style={{
        borderRadius: 16,
        padding:      "28px 24px",
        background:   "linear-gradient(135deg, rgba(78,222,163,0.06) 0%, rgba(78,222,163,0.02) 100%)",
        border:       "1px solid rgba(78,222,163,0.12)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        flexWrap:       "wrap",
        gap:            20,
      }}
    >
      <div style={{ minWidth: 240, flex: 1 }}>
        <h3
          style={{
            fontFamily:    "var(--font-headline, Manrope), sans-serif",
            fontSize:      18,
            fontWeight:    800,
            color:         "#e5e1e4",
            letterSpacing: "-0.01em",
            margin:        "0 0 6px",
          }}
        >
          {t("emptyTitle")}
        </h3>
        <p style={{ fontSize: 14, color: "#86948a", margin: 0, maxWidth: 460 }}>
          {t("emptyBody")}
        </p>
      </div>
      <Link
        href="/cursos"
        style={{
          display:        "inline-flex",
          alignItems:     "center",
          gap:            6,
          padding:        "10px 20px",
          background:     "#4edea3",
          borderRadius:   8,
          color:          "#003824",
          fontSize:       11,
          fontWeight:     700,
          textTransform:  "uppercase",
          letterSpacing:  "0.08em",
          fontFamily:     "inherit",
          textDecoration: "none",
        }}
      >
        {t("emptyCta")}
        <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 14 }}>
          arrow_forward
        </span>
      </Link>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function MyCoursesPanel() {
  const t = useTranslations("areaPersonal.courses");
  const locale = useLocale();
  const [state, setState] = useState<EnrollmentsState>("loading");

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/courses/progress?locale=${encodeURIComponent(locale)}`)
      .then(async (res) => {
        // 204 = signed out (the session expired under an open tab); anything else
        // non-OK is a failure. Both hide the panel rather than shouting about it.
        if (!res.ok || res.status === 204) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { enrollments?: EnrolledCourseView[] };
        if (!cancelled) setState(data.enrollments ?? "hidden");
      })
      .catch(() => {
        if (!cancelled) setState("hidden");
      });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Loading renders nothing rather than a skeleton: the panel sits below the fold,
  // and a placeholder that resolves to "hidden" would shift the page for no gain.
  if (state === "loading" || state === "hidden") return null;

  return (
    <section>
      <h2
        style={{
          fontFamily:    "var(--font-headline, Manrope), sans-serif",
          fontSize:      16,
          fontWeight:    800,
          color:         "#e5e1e4",
          letterSpacing: "-0.01em",
          margin:        "0 0 16px",
        }}
      >
        {t("title")}
      </h2>

      {state.length === 0 ? (
        <CoursesInvitation />
      ) : (
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap:                 16,
          }}
        >
          {state.map((view) => (
            <CourseProgressCard key={view.courseSlug} view={view} />
          ))}
        </div>
      )}
    </section>
  );
}
