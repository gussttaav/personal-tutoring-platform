"use client";

/*
 * COURSE-P1-04 — "On this page" heading outline (desktop right rail).
 *
 * Client island (the ONLY client JS the reader adds beyond the mobile drawer). The
 * lesson body itself is still fully server-rendered static HTML — this component only
 * scroll-spies the rendered h2/h3 to highlight the section in view. Ids come from
 * `extractHeadings` (src/lib/courses/headings.ts), which shares github-slugger with the
 * `rehype-slug` in the pipeline so the `#id` links land on the real headings.
 *
 * Visuals mirror the left rail: a continuous vertical bar whose ACTIVE segment is green
 * with brighter text, dim otherwise. h3 entries indent under their h2 (section
 * hierarchy). Desktop-only: LessonLayout's CSS hides the rail below 1280px.
 *
 * Renders nothing when a lesson has no headings.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { HeadingOutline } from "@/lib/courses/headings";
import { activeHeadingId } from "./scroll-spy";

interface OnThisPageProps {
  headings: HeadingOutline[];
}

// The reading line, in px from the viewport top: a heading counts as "current" once it
// scrolls above this (fixed navbar height + a little air).
const SPY_OFFSET = 100;

export default function OnThisPage({ headings }: OnThisPageProps) {
  const t = useTranslations("courses.reader");
  // COURSE-P5-00: starts as `null`, NOT `headings[0]`. Every lesson opens with untitled
  // prose (motivación + intuición — see docs/courses/AUTHORING.md §1), so highlighting
  // the first section on load pointed the rail at somewhere the reader had not reached.
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;
    const ids = headings.map((h) => h.id);

    const onScroll = () => {
      // Headings are in document order → the active one is the LAST whose top has
      // crossed the reading line, and none is active above the first.
      const positions = ids
        .map((id) => ({ id, el: document.getElementById(id) }))
        .filter((p): p is { id: string; el: HTMLElement } => p.el !== null)
        .map(({ id, el }) => ({ id, top: el.getBoundingClientRect().top }));

      setActiveId(activeHeadingId(positions, SPY_OFFSET));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label={t("onThisPage")} style={{ fontSize: "0.8125rem", padding: "8px 0" }}>
      <p
        style={{
          margin: "0 0 12px",
          paddingLeft: "14px",
          fontFamily: "var(--font-headline, Manrope), sans-serif",
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
        }}
      >
        {t("onThisPage")}
      </p>
      {/* Continuous rail: each item's left border joins (no gap); the active segment
          is green, the rest dim. */}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
        {headings.map((h) => {
          const isActive = h.id === activeId;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                aria-current={isActive ? "true" : undefined}
                style={{
                  display: "block",
                  borderLeft: `2px solid ${isActive ? "var(--green)" : "var(--border-variant)"}`,
                  // h3 indents under h2 — the rail stays put, only the text shifts.
                  paddingLeft: h.depth === 3 ? "28px" : "14px",
                  paddingTop: "5px",
                  paddingBottom: "5px",
                  color: isActive ? "var(--text)" : "var(--text-dim)",
                  fontWeight: isActive ? 600 : 400,
                  textDecoration: "none",
                  lineHeight: 1.45,
                }}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
