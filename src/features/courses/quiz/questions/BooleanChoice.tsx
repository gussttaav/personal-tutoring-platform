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

import { chosenTagStyle, optionInputStyle, optionRowStyle, optionTextStyle } from "./choice-styles";

export interface BooleanChoiceProps {
  name: string;
  selection: boolean | null;
  disabled: boolean;
  /** True once the answer has been submitted. The two rows are never coloured — the
   *  verdict below says whether it was right — but the reader must still be able to
   *  see WHICH one they chose, and the disabled control alone does not show it. */
  graded: boolean;
  trueLabel: string;
  falseLabel: string;
  /** "Tu respuesta" — see chosenTagStyle for why the choice is stated in text. */
  chosenLabel: string;
  onSelect: (value: boolean) => void;
}

export function BooleanChoice({
  name,
  selection,
  disabled,
  graded,
  trueLabel,
  falseLabel,
  chosenLabel,
  onSelect,
}: BooleanChoiceProps) {
  return (
    <>
      {[
        { value: true, label: trueLabel },
        { value: false, label: falseLabel },
      ].map(({ value, label }) => {
        const chosen = selection === value;

        return (
          <label key={label} style={optionRowStyle("idle", disabled)}>
            <input
              type="radio"
              name={name}
              checked={chosen}
              disabled={disabled}
              onChange={() => onSelect(value)}
              style={optionInputStyle}
            />
            <span style={optionTextStyle}>{label}</span>
            {graded && chosen ? <span style={chosenTagStyle}>{chosenLabel}</span> : null}
          </label>
        );
      })}
    </>
  );
}
