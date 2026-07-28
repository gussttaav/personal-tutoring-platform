/*
 * COURSE-P3-01 — `multi`: several correct options, graded ALL-OR-NOTHING.
 *
 * There is no partial credit, and the notice above the boxes says so BEFORE the
 * student submits. A subset is not "nearly right": it is a different claim about the
 * material, and a scoring rule the student learns only after being marked wrong is
 * a bad rule.
 *
 * Order is authoring order — never shuffled (see SingleChoice).
 */

"use client";

import type { RenderedOption } from "../QuizCard";
import { optionInputStyle, optionRowStyle, optionTextStyle } from "./choice-styles";

export interface MultiChoiceProps {
  options: RenderedOption[];
  selection: string[];
  /** The correct option ids — supplied only once the answer has been graded. */
  answer: string[] | null;
  disabled: boolean;
  notice: string;
  onToggle: (optionId: string) => void;
}

export function MultiChoice({ options, selection, answer, disabled, notice, onToggle }: MultiChoiceProps) {
  return (
    <>
      <p style={{ margin: "0 0 0.6rem", fontSize: "0.8rem", color: "var(--text-dim)" }}>{notice}</p>
      {options.map((option) => {
        const checked = selection.includes(option.id);
        const state = !answer
          ? "idle"
          : answer.includes(option.id)
            ? "correct"
            : checked
              ? "missed"
              : "idle";

        return (
          <label key={option.id} style={optionRowStyle(state, disabled)}>
            <input
              type="checkbox"
              value={option.id}
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle(option.id)}
              style={optionInputStyle}
            />
            <span style={optionTextStyle}>{option.label}</span>
          </label>
        );
      })}
    </>
  );
}
