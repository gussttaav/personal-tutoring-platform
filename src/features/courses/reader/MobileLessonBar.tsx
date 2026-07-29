"use client";

/*
 * COURSE-P1-04 — Sticky mobile top bar + navigation drawer.
 *
 * Shown only below 768px (LessonLayout's CSS hides the wrapper on desktop). The bar
 * carries the drawer toggle, the lesson title, and a progress slot — filled by
 * COURSE-P4-02 with `MobileProgressIndicator`, which owns all the logic; this file
 * still holds none.
 *
 * The drawer reuses the ComingSoonModal dismissal pattern — body scroll-lock via
 * `document.body.style.overflow`, close on Escape, close on backdrop click — and ADDS
 * the two things that modal lacks and this task requires: a focus TRAP (Tab cycles
 * within the panel) and focus RESTORE to the toggle on close. The panel receives the
 * server-rendered `LessonSidebar` as `children`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import MobileProgressIndicator from "./MobileProgressIndicator";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface MobileLessonBarProps {
  title:    string;
  children: ReactNode; // the LessonSidebar nav
}

export default function MobileLessonBar({ title, children }: MobileLessonBarProps) {
  const t = useTranslations("courses.reader");
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Scroll-lock + Escape + focus trap while open; restore focus to the toggle on close.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = triggerRef.current;
    document.body.style.overflow = "hidden";

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
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      // Restore focus to the control that opened the drawer.
      previouslyFocused?.focus();
    };
  }, [open, close]);

  return (
    <div className="lesson-mobilebar">
      <div
        style={{
          position: "sticky",
          // Sit just below the fixed global navbar (see --nav-h in lesson.css),
          // not underneath it.
          top: "var(--nav-h, 72px)",
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          height: "52px",
          padding: "0 12px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
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
