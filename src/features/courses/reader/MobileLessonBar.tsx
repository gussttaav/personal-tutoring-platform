"use client";

/*
 * COURSE-P1-04 — Fixed mobile top bar + navigation drawer.
 *
 * Shown only below 768px (LessonLayout's CSS hides the wrapper on desktop). The bar
 * carries the drawer toggle, the lesson title, and a progress slot — filled by
 * COURSE-P4-02 with `MobileProgressIndicator`, which owns all the logic; this file
 * still holds none.
 *
 * The bar is `position: fixed` and hides on scroll-DOWN, reveals on scroll-UP (and
 * whenever the reader is near the top) — a lesson is a long read on a phone and a
 * permanently parked bar is 52px of prose lost on every screen. It was `position:
 * sticky` before, but its sticky container (`.lesson-mobilebar`) wraps only the bar,
 * not the article beside it, so it was never actually sticky over the content. The
 * drawer toggle AND the search trigger live here, so the reveal-on-scroll-up gesture
 * is the reader's way back to both from mid-lesson; opening either overlay also forces
 * the bar shown so its controls are there again the moment the overlay closes.
 *
 * The drawer reuses the ComingSoonModal dismissal pattern — body scroll-lock, close on
 * Escape, close on backdrop click — and ADDS the two things that modal lacks and this task
 * requires: a focus TRAP (Tab cycles within the panel) and focus RESTORE to the toggle on
 * close. The panel receives the server-rendered `LessonSidebar` as `children`.
 *
 * COURSE-P9-01: the scroll lock now goes through the ref-counted `lockBodyScroll` instead
 * of setting `document.body.style.overflow` here. With the search dialog as a second
 * overlay, the direct version was a bug waiting to happen: open the drawer, open search
 * from inside it, close search — and the page unlocks while the drawer is still up.
 * This file also carries the MOBILE search trigger; the desktop one is in LessonLayout.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import MobileProgressIndicator from "./MobileProgressIndicator";
import CourseSearchTrigger from "@/features/courses/search/CourseSearchTrigger";
import { useCourseSearch } from "@/features/courses/search/CourseSearchProvider";
import { lockBodyScroll } from "@/hooks/scroll-lock";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface MobileLessonBarProps {
  title:    string;
  children: ReactNode; // the LessonSidebar nav
}

export default function MobileLessonBar({ title, children }: MobileLessonBarProps) {
  const t = useTranslations("courses.reader");
  const { open: searchOpen } = useCourseSearch();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  // Scroll-direction state only — never forced here. `showBar` below OR-s in the two
  // overlays, so an open drawer/search always renders the bar shown without this
  // effect having to write state synchronously.
  const [scrolledAway, setScrolledAway] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Hide on scroll-down, reveal on scroll-up / near the top. The listener is off while
  // the drawer or the search dialog owns the screen (they lock body scroll anyway).
  useEffect(() => {
    if (open || searchOpen) return;

    const REVEAL_ABOVE = 96; // px from the top: always shown here
    const JITTER = 6;        // px: ignore rubber-band / sub-pixel scroll noise

    let lastY = Math.max(0, window.scrollY);
    let raf = 0;

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = Math.max(0, window.scrollY);
        const delta = y - lastY;
        if (Math.abs(delta) < JITTER) return; // let small moves accumulate
        if (y <= REVEAL_ABOVE) setScrolledAway(false);
        else setScrolledAway(delta > 0);
        lastY = y;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [open, searchOpen]);

  // Tapping Search must open it regardless of scroll position, and the drawer toggle
  // is only tappable when the bar is already up — so an open overlay pins the bar.
  const showBar = open || searchOpen || !scrolledAway;

  // Scroll-lock + Escape + focus trap while open; restore focus to the toggle on close.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = triggerRef.current;
    const releaseScroll = lockBodyScroll();

    // Move focus into the panel (first focusable, else the panel itself).
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === firstEl || active === panel)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      releaseScroll();
      window.removeEventListener("keydown", onKey);
      // Restore focus to the control that opened the drawer.
      previouslyFocused?.focus();
    };
  }, [open, close]);

  return (
    <div className="lesson-mobilebar">
      <div
        style={{
          position: "fixed",
          // Sit just below the fixed global navbar (see --nav-h in lesson.css),
          // not underneath it. `.lesson-mobilebar` reserves this height in flow.
          top: "var(--nav-h, 72px)",
          left: 0,
          right: 0,
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          height: "52px",
          padding: "0 12px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          // Hidden = slid fully above the viewport (clear of the translucent navbar).
          transform: showBar
            ? "translateY(0)"
            : "translateY(calc(-100% - var(--nav-h, 72px)))",
          transition: reducedMotion ? "none" : "transform 0.22s ease",
        }}
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("openNav")}
          aria-expanded={open}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "36px",
            height: "36px",
            flexShrink: 0,
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }} aria-hidden="true">
            menu
          </span>
        </button>

        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>

        {/* COURSE-P9-01: search sits beside the progress slot, in the persistent bar
            rather than behind the drawer toggle — it is a primary action on mobile too. */}
        <CourseSearchTrigger variant="icon" />

        {/* COURSE-P4-02: the slot P1-04 reserved, now filled. The indicator renders
            nothing at all when progress is untracked. */}
        <div className="lesson-progress-slot" style={{ flexShrink: 0 }}>
          <MobileProgressIndicator />
        </div>
      </div>

      {open ? (
        <>
          <div
            onClick={close}
            style={{
              position: "fixed",
              inset: 0,
              // Above the fixed navbar (z-50) so the open drawer covers it.
              zIndex: 60,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
            }}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("contentsLabel")}
            tabIndex={-1}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              zIndex: 61,
              width: "min(320px, 85vw)",
              overflowY: "auto",
              overscrollBehavior: "contain",
              padding: "16px 16px 32px",
              background: "var(--surface)",
              borderRight: "1px solid var(--border)",
              boxShadow: "8px 0 40px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
              <button
                type="button"
                onClick={close}
                aria-label={t("closeNav")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }} aria-hidden="true">
                  close
                </span>
              </button>
            </div>
            {/* Navigating within the drawer should dismiss it. */}
            <div onClick={(e) => { if ((e.target as HTMLElement).closest("a")) close(); }}>
              {children}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
