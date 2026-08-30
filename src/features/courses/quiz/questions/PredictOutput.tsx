/*
 * COURSE-P3-01 — `predict-output`: show code, ask what it prints.
 *
 * The student TYPES the expected stdout rather than picking from a list. Reading a
 * loop and predicting its output is the skill; recognising the right answer among
 * four is not, and a list is guessable. The grader normalises trailing whitespace and
 * line endings but stays case-sensitive — Python's output is.
 *
 * The snippet arrives already Shiki-highlighted from the server (see Quiz.tsx), so
 * this cell costs the lesson no highlighter JS. It is NOT runnable: `<PyCell>` is for
 * running code, and letting the student execute the snippet would defeat the question.
 */

"use client";

import type { ReactElement } from "react";

const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

export interface PredictOutputProps {
  code: ReactElement | null;
  value: string;
  disabled: boolean;
  label: string;
  placeholder: string;
  onChange: (value: string) => void;
}

export function PredictOutput({ code, value, disabled, label, placeholder, onChange }: PredictOutputProps) {
  return (
    <div style={{ minWidth: 0 }}>
      {/* The `pre` override in the quiz render map (lib/courses/quiz/render.tsx)
          scrolls this in its own box, so a long line never widens the card. */}
      <div style={{ minWidth: 0, maxWidth: "100%" }}>{code}</div>
      <label style={{ display: "block", marginTop: "0.9rem" }}>
        <span style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
          {label}
        </span>
        <textarea
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          rows={3}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            padding: "0.6rem 0.8rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            background: "var(--surface-lowest)",
            color: "var(--text)",
            fontFamily: mono,
            fontSize: "0.85rem",
            lineHeight: 1.6,
            resize: "vertical",
          }}
        />
      </label>
    </div>
  );
}
