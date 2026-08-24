/*
 * COURSE-P3-01 — `numeric`: a computed number, graded within a tolerance.
 *
 * The type that makes this a maths course rather than a trivia quiz: "compute ∂L/∂w
 * for these values". The tolerance is shown up front so the student knows how much
 * rounding is acceptable before they answer.
 *
 * `inputMode="decimal"` gives phones a numeric keypad; the value is parsed here so
 * the reducer only ever sees a number or `null` (empty / mid-typing "-" / "1e").
 */

"use client";

export interface NumericInputProps {
  value: number | null;
  unit?: string;
  disabled: boolean;
  placeholder: string;
  toleranceNote: string;
  onChange: (value: number | null) => void;
}

export function NumericInput({
  value,
  unit,
  disabled,
  placeholder,
  toleranceNote,
  onChange,
}: NumericInputProps) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          type="number"
          inputMode="decimal"
          step="any"
          value={value === null ? "" : value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            const parsed = Number.parseFloat(e.target.value);
            onChange(Number.isFinite(parsed) ? parsed : null);
          }}
          style={{
            width: "10rem",
            maxWidth: "100%",
            padding: "0.5rem 0.7rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            background: "var(--surface-lowest)",
            color: "var(--text)",
            fontSize: "0.95rem",
          }}
        />
        {unit ? <span style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>{unit}</span> : null}
      </div>
      <p style={{ margin: "0.45rem 0 0", fontSize: "0.8rem", color: "var(--text-dim)" }}>
        {toleranceNote}
      </p>
    </div>
  );
}
