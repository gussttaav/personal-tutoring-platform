"use client";

/*
 * BLOG — "On this page" heading outline (desktop right rail).
 *
 * The blog counterpart of the lesson reader's rail (src/features/courses/reader/
 * OnThisPage.tsx, COURSE-P1-04), and — like PostReading — written fresh rather than
 * imported: that module reads the `courses.reader` namespace. Shared are the pure
 * helpers behind it: `HeadingOutline` / `extractHeadings` (src/lib/courses/headings.ts)
 * and `activeHeadingId` (the scroll-spy maths). Ids come from `extractHeadings`, which
 * shares github-slugger with the `rehype-slug` in the blog pipeline (src/lib/blog/
 * mdx.ts), so the `#id` links land on the real rendered headings.
 *
 * Client island (the only client JS a post ships). The post body itself stays fully
 * server-rendered — this component only scroll-spies the rendered h2/h3.
 *
 * ACCORDION: an h2's subsections (h3s) are collapsed by default and slide open only
 * while the reader is inside that h2's section — so exactly one group is expanded at a
 * time, or none above the first heading. Grouping/active-group logic is pure
 * (on-this-page-tree.ts); the open/close is a `grid-template-rows` transition, dropped
 * under `prefers-reduced-motion`.
 *
 * Desktop-only: post.css hides the rail below 1280px, where PostToc's disclosure (a
 * plain full list, no accordion) takes over. Renders nothing when a post has no
 * headings.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { HeadingOutline } from "@/lib/courses/headings";
import { activeHeadingId } from "@/features/courses/reader/scroll-spy";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { groupHeadings, activeGroupIndex } from "./on-this-page-tree";

interface OnThisPageProps {
  headings: HeadingOutline[];
}

// The reading line, in px from the viewport top: a heading counts as "current" once it
// scrolls above this (fixed navbar height + a little air).
const SPY_OFFSET = 100;

function linkStyle(isActive: boolean, indented: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    borderLeft: `2px solid ${isActive ? "var(--green)" : "var(--border-variant)"}`,
    // h3 text indents under its h2; the rail (the border) stays put.
    paddingLeft: indented ? "28px" : "14px",
    paddingTop: "5px",
    paddingBottom: "5px",
    color: isActive ? "var(--text)" : "var(--text-dim)",
    fontWeight: isActive ? 600 : 400,
    textDecoration: "none",
    lineHeight: 1.45,
  };
}

export default function OnThisPage({ headings }: OnThisPageProps) {
  const t = useTranslations("blog.post");
  const reducedMotion = useReducedMotion();
  // Starts as `null`, NOT `headings[0]`: a post opens with a lede that carries no
  // heading, so highlighting (and expanding) the first section on load would point the
  // rail somewhere the reader has not reached.
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

  const groups = groupHeadings(headings);
  const openIndex = activeGroupIndex(groups, activeId);

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

      {/* Continuous rail: every link carries a left border that joins the next (no
          gap); the active segment is green, the rest dim. */}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
        {groups.map((group, i) => {
          const hasChildren = group.children.length > 0;
          // A `null`-h2 group (leading orphan h3s) has nothing to collapse under.
          const expanded = group.h2 === null || i === openIndex;

          return (
            <li key={group.h2?.id ?? `pre-${i}`}>
              {group.h2 && (
                <a
                  href={`#${group.h2.id}`}
                  aria-current={group.h2.id === activeId ? "true" : undefined}
                  // Open the clicked group at once; the scroll-spy confirms it as the
                  // smooth-scroll arrives, instead of the reader watching it expand late.
                  onClick={() => setActiveId(group.h2!.id)}
                  style={linkStyle(group.h2.id === activeId, false)}
                >
                  <span style={{ minWidth: 0 }}>{group.h2.text}</span>
                  {hasChildren && (
                    <svg
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      style={{
                        flexShrink: 0,
                        transformOrigin: "center",
                        transform: expanded ? "none" : "rotate(-90deg)",
                        transition: reducedMotion ? "none" : "transform 180ms ease",
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  )}
                </a>
              )}

              {hasChildren && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateRows: expanded ? "1fr" : "0fr",
                    transition: reducedMotion ? "none" : "grid-template-rows 200ms ease",
                  }}
                >
                  {/* overflow:hidden both clips the closed state and lets the grid row
                      shrink to 0 (min-height:auto resolves to 0 when overflow != visible). */}
                  <div style={{ overflow: "hidden" }} inert={!expanded}>
                    <ul
                      style={{
                        listStyle: "none",
                        margin: 0,
                        padding: 0,
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {group.children.map((child) => (
                        <li key={child.id}>
                          <a
                            href={`#${child.id}`}
                            aria-current={child.id === activeId ? "true" : undefined}
                            onClick={() => setActiveId(child.id)}
                            style={linkStyle(child.id === activeId, true)}
                          >
                            <span style={{ minWidth: 0 }}>{child.text}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
