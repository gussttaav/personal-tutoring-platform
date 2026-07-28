/*
 * COURSE-P3-01 — `boolean`: true/false.
 *
 * A coin flip is right half the time, so the score here carries almost no signal —
 * which is why the schema makes `explanation` mandatory on every question type. The
 * explanation is what a true/false question is actually for.
 *
 * The labels come from `t()`, not from the author: unlike an option's text they are
 * chrome, and the reader is bilingual.
 */

"use client";

import { optionInputStyle, optionRowStyle, optionTextStyle } from "./choice-styles";

export interface BooleanChoiceProps {
  name: string;
  selection: boolean | null;
  disabled: boolean;
  trueLabel: string;
  falseLabel: string;
  onSelect: (value: boolean) => void;
}

export function BooleanChoice({
  name,
  selection,
  disabled,
  trueLabel,
  falseLabel,
  onSelect,
}: BooleanChoiceProps) {
  return (
    <>
      {[
        { value: true, label: trueLabel },
        { value: false, label: falseLabel },
      ].map(({ value, label }) => (
        <label key={label} style={optionRowStyle("idle", disabled)}>
          <input
            type="radio"
            name={name}
            checked={selection === value}
            disabled={disabled}
            onChange={() => onSelect(value)}
            style={optionInputStyle}
          />
          <span style={optionTextStyle}>{label}</span>
        </label>
      ))}
    </>
  );
}
