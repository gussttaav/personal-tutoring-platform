/*
 * COURSE-P3-01 — Shared row styling for the option-list question types.
 *
 * `single`, `multi` and `boolean` are three different controls that must read as one
 * component, so the row metrics live here rather than being copied three times.
 *
 * `minWidth: 0` + the inner scroll box are load-bearing: an option can hold a long
 * KaTeX expression, and at 360px that must scroll inside the row instead of widening
 * the whole lesson body.
 */

import type { CSSProperties } from "react";

/** `state` colours the row once the answer has been graded. */
export type RowState = "idle" | "correct" | "missed";

const ROW_ACCENT: Record<RowState, { border: string; background: string }> = {
  idle:    { border: "var(--border)",   background: "var(--surface-lowest)" },
  correct: { border: "var(--green-mid)", background: "var(--green-dim)" },
  missed:  { border: "var(--error)",     background: "var(--error-bg)" },
};

export function optionRowStyle(state: RowState, disabled: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.65rem",
    margin: "0.4rem 0",
    padding: "0.6rem 0.8rem",
    borderRadius: "var(--radius)",
    border: `1px solid ${ROW_ACCENT[state].border}`,
    background: ROW_ACCENT[state].background,
    color: "var(--text-muted)",
    fontSize: "0.95rem",
    cursor: disabled ? "default" : "pointer",
    minWidth: 0,
  };
}

/** Wraps the label text so a wide expression scrolls in its own box. */
export const optionTextStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: "100%",
  overflowX: "auto",
};

/** Nudges the native control onto the first text line. */
export const optionInputStyle: CSSProperties = {
  marginTop: "0.3rem",
  flexShrink: 0,
  accentColor: "var(--green)",
};
