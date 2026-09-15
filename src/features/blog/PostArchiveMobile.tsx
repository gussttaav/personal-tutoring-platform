"use client";

/*
 * BLOG-05 — the archive below 1024px: a floating hamburger + a left drawer.
 *
 * The desktop pane has no room on a phone, and a permanently parked control is prose
 * lost on every screen. So the trigger is a floating button that HIDES on scroll-DOWN
 * (the reader is reading) and comes back on scroll-UP or near the top — the gesture the
 * reader already makes to leave an article, the same one PostToc and the lesson
 * reader's MobileLessonBar answer. Same rAF-throttled listener with a jitter floor,
 * suspended while the drawer owns the screen.
 *
 * The drawer copies MobileLessonBar's dismissal contract — body scroll-lock, close on
 * Escape, close on backdrop click, a focus TRAP (Tab cycles within the panel), focus
 * RESTORE to the button on close, and a tap on any link inside closes it — and adds a
 * slide-in on mount (CSS keyframe in post.css, dropped under `prefers-reduced-motion`;
 * no exit animation: the drawer unmounts).
 *
 * MOUNTED OUTSIDE <main> on purpose. The post page's <main> is `position: relative;
 * z-index: 1`, a stacking context, and the fixed global Navbar (z-50) is its sibling —
 * a backdrop rendered inside <main> could never rise above the navbar whatever its
 * z-index. As a sibling, the backdrop (60) and panel (61) cover it, as in the lesson
 * reader. post.css hides the whole thing at ≥1024px, where the pane takes over.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { lockBodyScroll } from "@/hooks/scroll-lock";
import PostArchive from "./PostArchive";
import type { ArchiveEntry } from "./archive-tree";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const REVEAL_ABOVE = 96; // px from the top: always shown here
const JITTER = 6;        // px: ignore rubber-band / sub-pixel scroll noise

interface PostArchiveMobileProps {
  entries:     ArchiveEntry[];
  currentSlug: string;
}

export default function PostArchiveMobile({ entries, currentSlug }: PostArchiveMobileProps) {
  const t = useTranslations("blog.archive");
  const [open, setOpen] = useState(false);
  // Scroll-direction state only. `showFab` below folds in `open`, so the button hides
  // under the backdrop without this effect writing state for it.
  const [scrolledAway, setScrolledAway] = useState(false);

  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const drawerId = useId();

  const close = useCallback(() => setOpen(false), []);

  // Hide on scroll-down, reveal on scroll-up / near the top. Off while the drawer is up
  // (it locks body scroll anyway); re-armed from the current position on close. Not run
  // eagerly: the server-rendered state is "shown", and hydration keeps it that way.
  useEffect(() => {
    if (open) return;

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
  }, [open]);

  const showFab = !scrolledAway && !open;

  // Scroll-lock + Escape + focus trap while open; restore focus to the button on close.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = fabRef.current;
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
      // Restore focus to the control that opened the drawer. By now React has
      // committed the close, so the button is no longer inert.
      previouslyFocused?.focus();
    };
  }, [open, close]);

  return (
    <div className="post-archive-mobile">
      {/* `inert` while hidden: a faded-out button must not be a Tab stop. */}
      <button
        ref={fabRef}
        type="button"
        className={`post-archive-fab${showFab ? "" : " post-archive-fab--hidden"}`}
        inert={!showFab}
        aria-label={t("openDrawer")}
        aria-expanded={open}
        aria-controls={open ? drawerId : undefined}
        onClick={() => setOpen(true)}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          menu
        </span>
      </button>

      {open ? (
        <>
          <div className="post-archive-backdrop" onClick={close} />
          <div
            ref={panelRef}
            id={drawerId}
            role="dialog"
            aria-modal="true"
            aria-label={t("label")}
            tabIndex={-1}
            className="post-archive-drawer"
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
              <button
                type="button"
                onClick={close}
                aria-label={t("closeDrawer")}
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
            {/* Navigating within the drawer (an entry, or the back link) dismisses it. */}
            <div onClick={(e) => { if ((e.target as HTMLElement).closest("a")) close(); }}>
              <PostArchive entries={entries} currentSlug={currentSlug} variant="drawer" />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
