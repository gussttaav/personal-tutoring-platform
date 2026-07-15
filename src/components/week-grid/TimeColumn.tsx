"use client";

/**
 * REFACTOR-R3-P3-01 — Shared week-grid module
 *
 * The left "HH:MM" time gutter for the week grid. Parameterized so both surfaces
 * reproduce their exact metrics:
 *   - calendar: taller rows, paddingTop 4, sticky (stays visible while the grid
 *     scrolls horizontally on narrow screens)
 *   - modal: shorter rows (twice as many 30-min rows keep the height constant),
 *     paddingTop 3, non-sticky
 * Handles the 3-tier hierarchy (hour/half/quarter); the modal only ever produces
 * hour/half rows, so it renders identically to its former 2-tier copy.
 */

import { getTimeRowHierarchy, rowBorderTop, hourBandBackground } from "@/components/week-grid/helpers";

export interface TimeColumnProps {
  isMobile:     boolean;
  timeRows:     string[];
  rowHeight:    number;
  headerHeight: number;
  paddingTop:   number;
  /** Sticky column (calendar) vs static (modal). */
  sticky?:      boolean;
}

export function TimeColumn({
  isMobile,
  timeRows,
  rowHeight,
  headerHeight,
  paddingTop,
  sticky = false,
}: TimeColumnProps) {
  const wrapperStyle: React.CSSProperties = sticky
    ? {
        background: "#111113",
        position:   "sticky",
        left:       0,
        zIndex:     2,
        boxShadow:  "2px 0 6px rgba(0,0,0,0.5)",
      }
    : { background: "#111113" };

  return (
    <div style={wrapperStyle}>
      {/* Header spacer — aligns with day header cells */}
      <div style={{ height: headerHeight, borderBottom: "1px solid rgba(255,255,255,0.1)" }} />
      {/* Time labels — "HH:MM" for every row */}
      {timeRows.map((hhmm, i) => {
        const tier = getTimeRowHierarchy(hhmm);
        return (
          <div
            key={hhmm}
            style={{
              height:         rowHeight,
              display:        "flex",
              alignItems:     "flex-start",
              justifyContent: "flex-end",
              paddingRight:   8,
              paddingTop,
              borderTop:      rowBorderTop(i, hhmm),
              background:     hourBandBackground(hhmm),
              position:       "relative",
            }}
          >
            {/* Hour tick — a brighter emerald stub at the gutter's inner edge
                that anchors the eye to the hour line beside its label. */}
            {i > 0 && tier === "hour" && (
              <div
                aria-hidden="true"
                style={{
                  position:   "absolute",
                  top:        -2,
                  right:      0,
                  width:      8,
                  height:     2,
                  background: "rgba(78,222,163,0.5)",
                }}
              />
            )}
            <span style={{
              fontSize:           isMobile
                ? (tier === "hour" ? 9 : tier === "half" ? 7.5 : 7)
                : (tier === "hour" ? 10 : tier === "half" ? 8.5 : 8),
              fontWeight:         tier === "hour" ? 600 : 400,
              color:              tier === "hour"
                ? "#c2d0c8"
                : tier === "half"
                  ? "rgba(134,148,138,0.6)"
                  : "rgba(134,148,138,0.38)",
              fontVariantNumeric: "tabular-nums",
              whiteSpace:         "nowrap",
            }}>
              {hhmm}
            </span>
          </div>
        );
      })}
    </div>
  );
}
