/*
 * COURSE-P2-01 — Labeled range slider primitive.
 *
 * A thin wrapper over the native <input type="range">, which is keyboard-operable
 * for free (arrow keys, Home/End) and screen-reader friendly. Controlled: the
 * widget owns the value. Renders a label + live value readout wired via
 * htmlFor/id and aria so the control is properly named.
 */

"use client";

import { useId } from "react";

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Formats the value readout (default: as-is). */
  format?: (value: number) => string;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format = (v) => String(v),
}: SliderProps) {
  const id = useId();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "100%" }}>
      <label
        htmlFor={id}
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "0.75rem",
          fontSize: "0.85rem",
          color: "var(--text-muted)",
        }}
      >
        <span>{label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--text)" }}>
          {format(value)}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--green)" }}
      />
    </div>
  );
}
