"use client";

/*
 * BLOG — "On this page" outline, mobile / tablet form.
 *
 * The lesson reader's rail is desktop-only; below 1280px this native <details> stands
 * in for it (post.css swaps the two at that breakpoint). It carries the same h2/h3
 * anchor list as the desktop rail (OnThisPage.tsx).
 *
 * REVEAL-ON-SCROLL-UP: parked in flow at the top of the article, it becomes a
 * `position: sticky` bar once the reader scrolls past it — hidden on scroll-DOWN, slid
 * back in on scroll-UP, the same gesture the lesson reader's MobileLessonBar uses. A
 * phone reader mid-article gets the outline back without scrolling all the way up for
 * it. The auto-hide is suspended while the reader has it open, and a tap on an entry
 * folds it away as it navigates.
 *
 * A client island now (was a Server Component) for the scroll listener; the markup is
 * still fully in the prerendered HTML — entries indexable / find-in-page reachable
 * while closed. Renders nothing when the post has no headings.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { HeadingOutline } from "@/lib/courses/headings";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface PostTocProps {
  headings: HeadingOutline[];
}

const NAV_H = 72; // keep in sync with --nav-h (the fixed global navbar)
const JITTER = 6; // px: ignore rubber-band / sub-pixel scroll noise

export default function PostToc({ headings }: PostTocProps) {
  const t = useTranslations("blog.post");
  const reducedMotion = useReducedMotion();
  const [scrolledDown, setScrolledDown] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);

  // Hide on scroll-DOWN, reveal on scroll-UP. Listener is off while the reader has the
  // outline open (they are using it) — closing it re-arms the gesture.
  useEffect(() => {
    if (headings.length === 0 || open) return;

    let lastY = Math.max(0, window.scrollY);
    let raf = 0;

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = ref.current;
        if (!el) return;
        const y = Math.max(0, window.scrollY);
        const delta = y - lastY;
        // Until `sticky` engages the box is still in flow and visible — never hide it
        // there, or it would blank a gap between the header and the article.
        const pinned = el.getBoundingClientRect().top <= NAV_H + 2;
        if (!pinned) {
          setScrolledDown(false);
          lastY = y;
          return;
        }
        if (Math.abs(delta) < JITTER) return; // let small moves accumulate
        setScrolledDown(delta > 0);
        lastY = y;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [headings, open]);

  if (headings.length === 0) return null;

  const hidden = scrolledDown && !open;

  return (
    <details
      ref={ref}
      className="post-toc"
      inert={hidden}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      style={{
        transform: hidden ? `translateY(calc(-100% - ${NAV_H}px - 16px))` : "translateY(0)",
        transition: reducedMotion ? "none" : "transform 0.22s ease",
      }}
    >
      <summary className="post-toc-summary">
        <svg
          className="post-toc-chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span className="post-toc-kicker">{t("onThisPage")}</span>
      </summary>

      {/* A tap on an entry navigates AND folds the bar away (out of the reader's way at
          the section they just jumped to; a scroll-up brings it back). */}
      <ul
        className="post-toc-list"
        onClick={() => {
          if (ref.current) ref.current.open = false;
          setScrolledDown(true);
        }}
      >
        {headings.map((h) => (
          <li key={h.id} data-depth={h.depth}>
            <a href={`#${h.id}`}>{h.text}</a>
          </li>
        ))}
      </ul>
    </details>
  );
}
