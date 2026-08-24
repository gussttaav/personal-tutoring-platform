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
    // COURSE-P4-04: lets the "Tu respuesta" tag drop to its own line rather than
    // squeezing the option text into a two-word column on a phone.
    flexWrap: "wrap",
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

/** Wraps the label text so a wide expression scrolls in its own box.
 *
 *  The `10rem` flex-basis is what decides where the "Tu respuesta" tag goes: while the
 *  text can have that much room beside the tag they share a line; below it the row
 *  wraps and the tag takes its own. Without a basis the text would shrink to nothing
 *  (`minWidth: 0`) and the tag would never wrap. */
export const optionTextStyle: CSSProperties = {
  flex: "1 1 10rem",
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

/*
 * COURSE-P4-04 — "Tu respuesta", on the row the reader actually chose.
 *
 * Grading disables the inputs, and a DISABLED control does not honour `accent-color`:
 * every browser greys it out, so on these dark rows the checked dot becomes grey on
 * grey and the reader cannot see which option they picked. Reported from a real
 * screenshot; reproduced signed-out, so it has nothing to do with restored history.
 *
 * The fix is deliberately NOT "stop disabling the inputs". A graded group must not be
 * editable until Retry, and `disabled` is the honest way to say so — to the pointer,
 * the keyboard and the accessibility tree alike. Instead the choice is stated in text,
 * which no native-control theming can take away.
 *
 * It also closes a real ambiguity that predates the styling problem: when the reader
 * answers CORRECTLY, the green row means "this is the right answer" and nothing on
 * screen said "…and it is the one you chose". Now something does.
 */
export const chosenTagStyle: CSSProperties = {
  flexShrink: 0,
  marginLeft: "auto",
  marginTop: "0.15rem",
  padding: "0.1rem 0.45rem",
  borderRadius: "999px",
  border: "1px solid var(--border-variant)",
  color: "var(--text-dim)",
  fontSize: "0.7rem",
  whiteSpace: "nowrap",
};
