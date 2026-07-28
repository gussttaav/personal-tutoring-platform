/*
 * COURSE-P3-01 — `single`: exactly one correct option.
 *
 * Native radios in labels, so keyboard operation (arrow keys within the group,
 * space to select) and screen-reader semantics come from the platform.
 *
 * Options are rendered in AUTHORING ORDER and never shuffled — explanations are
 * allowed to say "la opción B", and a shuffled list would make both the explanation
 * and a persisted answer meaningless. Authors vary the correct position by hand.
 */

"use client";

import type { RenderedOption } from "../QuizCard";
import { optionInputStyle, optionRowStyle, optionTextStyle } from "./choice-styles";

export interface SingleChoiceProps {
  /** Shared radio group name; the card passes a `useId` value. */
  name: string;
  options: RenderedOption[];
  selection: string | null;
  /** The correct option id — supplied only once the answer has been graded. */
  answer: string | null;
  disabled: boolean;
  onSelect: (optionId: string) => void;
}

export function SingleChoice({ name, options, selection, answer, disabled, onSelect }: SingleChoiceProps) {
  return (
    <>
      {options.map((option) => {
        const graded = answer !== null;
        const state = !graded
          ? "idle"
          : option.id === answer
            ? "correct"
            : option.id === selection
              ? "missed"
              : "idle";

        return (
          <label key={option.id} style={optionRowStyle(state, disabled)}>
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={selection === option.id}
              disabled={disabled}
              onChange={() => onSelect(option.id)}
              style={optionInputStyle}
            />
            <span style={optionTextStyle}>{option.label}</span>
          </label>
        );
      })}
    </>
  );
}
