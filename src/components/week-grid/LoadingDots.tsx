"use client";

/**
 * REFACTOR-R3-P3-01 — Shared week-grid module
 *
 * Three-dot loading indicator shown in a day column while its slots load.
 * Unifies the two former copies (calendar `wcalPulse`, modal `availDotPulse`)
 * under a single keyframe name; both parents center it, so the internal
 * justify-content is inert for either.
 */

export function LoadingDots() {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width:        3,
            height:       3,
            borderRadius: "50%",
            background:   "#86948a",
            animation:    `wgDotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes wgDotPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  );
}
