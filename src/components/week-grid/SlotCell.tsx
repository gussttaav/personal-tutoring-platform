"use client";

/**
 * REFACTOR-R3-P3-01 — Shared week-grid module
 *
 * One grid cell (available / booked / unavailable). Union of the two former
 * copies: the calendar's block-selection variant (inSel/inFocus with top/bottom
 * rounding, invalid state) is the superset; the modal drives a single-cell
 * subset (inFocus only, isFocusTop/Bot = false → square focus, no selection/
 * invalid). All customer-facing strings (aria-label, hover titles) are passed in
 * by the consumer so this shared piece stays i18n-free.
 */

import { useState } from "react";

export interface SlotCellProps {
  state:      "available" | "booked" | "unavailable";
  /** aria-label for the available cell (consumer-localized). */
  availableLabel: string;
  /** Optional title tooltip for the unavailable / booked states (consumer-localized). */
  unavailableTitle?: string;
  bookedTitle?:      string;
  inSel:      boolean;
  isSelTop:   boolean;
  isSelBot:   boolean;
  inFocus:    boolean;
  isFocusTop: boolean;
  isFocusBot: boolean;
  isInvalid:  boolean;
  onClick?:   () => void;
}

export function SlotCell({
  state,
  availableLabel,
  unavailableTitle,
  bookedTitle,
  inSel, isSelTop, isSelBot,
  inFocus, isFocusTop, isFocusBot,
  isInvalid,
  onClick,
}: SlotCellProps) {
  const [hovered, setHovered] = useState(false);

  if (state === "unavailable") {
    return (
      <div style={{
        width: "100%", height: "100%", borderRadius: 0,
        border: "1px solid rgba(255,255,255,0.04)",
        background: "repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 6px)",
        cursor: "default",
      }} title={unavailableTitle} />
    );
  }

  if (state === "booked") {
    return (
      <div style={{
        width: "100%", height: "100%", borderRadius: 0,
        border: "1px solid rgba(255,180,171,0.18)",
        background: "rgba(255,180,171,0.07)",
        cursor: "default",
      }} title={bookedTitle} />
    );
  }

  // Compute border-radius based on block position
  function blockRadius(isTop: boolean, isBot: boolean): string {
    const t = isTop ? 4 : 0;
    const b = isBot ? 4 : 0;
    return `${t}px ${t}px ${b}px ${b}px`;
  }

  let bg          = hovered ? "rgba(78,222,163,0.22)" : "rgba(78,222,163,0.13)";
  let borderColor = hovered ? "rgba(78,222,163,0.55)" : "rgba(78,222,163,0.3)";
  let radius      = "0";

  if (inSel || inFocus) {
    // Focus and selection paint identically, so a picked block reads the same
    // before and after it is committed and the single "Selected" legend entry
    // covers both. The whole block stays one uniform intensity so the
    // auto-covered cells (for 1h/2h durations) match the clicked anchor.
    bg          = "rgba(78,222,163,0.55)";
    borderColor = "rgba(78,222,163,0.8)";
    radius      = inSel ? blockRadius(isSelTop, isSelBot) : blockRadius(isFocusTop, isFocusBot);
  }

  if (isInvalid) {
    bg          = "rgba(239,68,68,0.25)";
    borderColor = "rgba(239,68,68,0.5)";
    radius      = "0";
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={inFocus}
      style={{
        width:          "100%",
        height:         "100%",
        display:        "flex",
        alignItems:     "flex-start",
        justifyContent: "flex-start",
        padding:        "3px 4px",
        cursor:         "pointer",
        border:         `1px solid ${borderColor}`,
        background:     bg,
        borderRadius:   radius,
        transition:     "background 0.12s, border-color 0.12s",
        fontFamily:     "inherit",
        overflow:       "hidden",
      }}
      aria-label={availableLabel}
    />
  );
}
