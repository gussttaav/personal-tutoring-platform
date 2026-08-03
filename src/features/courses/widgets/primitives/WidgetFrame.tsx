/*
 * COURSE-P2-01 — Shared chrome around every explorable widget.
 *
 * Its NON-NEGOTIABLE job: reserve the widget's height BEFORE it hydrates, so the
 * lesson never reflows under the reader while a widget loads (widgets are
 * `ssr:false`, so their body is empty in the server HTML — the frame is what holds
 * the space). It does that with a fixed-`minHeight` body, and renders the same box
 * for the loading skeleton, the widget, and an error.
 *
 * COURSE-P5-01 — the body used to carry `aspectRatio: minWidth / height` as well.
 * That was dead weight at best and a bug in practice: `minHeight` alone reserves the
 * space, while the ratio also made the box GROW with the column, so at a ~560px
 * reading width a 1:1 ratio demanded ~560px of height for content that needs ~330 —
 * a band of empty background above and below every widget. No widget relied on it:
 * each one sizes its own SVG with a fixed pixel `height` and scales the drawing via
 * `viewBox`, so the ratio never determined anything.
 *
 * It also carries the consistent border/background/radius from the design tokens
 * (mirrors mdx-components.tsx), an optional caption, and an optional reset control.
 * SVG text is unreadable below ~320px, so the body has a `minWidth` and scrolls
 * horizontally rather than shrinking labels.
 */

"use client";

import type { CSSProperties, ReactNode } from "react";

export interface WidgetFrameProps {
  children: ReactNode;
  /** Short description rendered under the widget. */
  caption?: ReactNode;
  /** When provided, renders a "Reset" button in the header that calls this. */
  onReset?: () => void;
  /** Reserved body height in px (default 320). This is what prevents layout shift. */
  height?: number;
  /** Minimum body width in px before horizontal scroll kicks in (default 320). */
  minWidth?: number;
  /** Optional title shown in the header. */
  title?: string;
}

const bodyBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflowX: "auto",
  overflowY: "hidden",
};

export function WidgetFrame({
  children,
  caption,
  onReset,
  height = 320,
  minWidth = 320,
  title,
}: WidgetFrameProps) {
  return (
    <div
      style={{
        margin: "1.75rem 0",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        background: "var(--surface-container)",
        overflow: "hidden",
      }}
    >
      {(title || onReset) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "0.6rem 1rem",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text)" }}>
            {title}
          </span>
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              style={{
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 600,
                padding: "0.3rem 0.7rem",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border-variant)",
                background: "var(--surface-lowest)",
                color: "var(--text-muted)",
              }}
            >
              Reset
            </button>
          ) : null}
        </div>
      )}

      {/* The space-reserving body. minHeight holds the row height even while empty. */}
      <div style={{ ...bodyBase, minHeight: height, padding: "0.75rem" }}>
        <div style={{ minWidth, width: "100%" }}>{children}</div>
      </div>

      {caption ? (
        <div
          style={{
            padding: "0.6rem 1rem",
            borderTop: "1px solid var(--border)",
            fontSize: "0.85rem",
            color: "var(--text-dim)",
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
}
