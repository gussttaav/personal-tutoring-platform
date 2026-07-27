/*
 * COURSE-P2-02 — Small toolbar button shared by the Block 0–1 widgets.
 *
 * `Explorable` already wraps every widget in one `WidgetFrame` (border/bg/caption),
 * so widgets must NOT render a second frame just to get its Reset button — that
 * would double the chrome. Instead they place their controls (reset, step, toggles)
 * inline with this button, which mirrors the frame's Reset styling so everything
 * still looks like one system. `active` gives toggle buttons a pressed state.
 */

"use client";

import type { ButtonHTMLAttributes } from "react";

export interface WidgetButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function WidgetButton({ active = false, style, disabled, ...props }: WidgetButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={props.role === "switch" || props["aria-pressed"] !== undefined ? active : undefined}
      style={{
        cursor: disabled ? "default" : "pointer",
        fontSize: "0.8rem",
        fontWeight: 600,
        padding: "0.3rem 0.7rem",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border-variant)",
        background: active ? "var(--green-container)" : "var(--surface-lowest)",
        color: active ? "#04140d" : "var(--text-muted)",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
      {...props}
    />
  );
}
