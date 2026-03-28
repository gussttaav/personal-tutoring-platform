"use client";

/**
 * WizardProgress — 3-step booking wizard indicator (UI only, no logic)
 *
 * Steps: Sesión (1) → Horario (2) → Revisión (3)
 * - Completed: filled emerald circle with check icon
 * - Active:    filled emerald circle with step number + emerald glow
 * - Inactive:  surface-container circle with outline-variant border
 */

interface WizardProgressProps {
  currentStep: 1 | 2 | 3;
}

const STEPS = [
  { n: 1, label: "Sesión" },
  { n: 2, label: "Horario" },
  { n: 3, label: "Revisión" },
] as const;

export default function WizardProgress({ currentStep }: WizardProgressProps) {
  return (
    <div className="mb-16">
      <div className="flex items-center justify-between max-w-2xl mx-auto relative">
        {/* Connecting line */}
        <div
          className="absolute top-5 left-0 w-full h-px"
          style={{ background: "#3c4a42", zIndex: 0 }}
        />

        {STEPS.map(({ n, label }) => {
          const isDone   = n < currentStep;
          const isActive = n === currentStep;

          return (
            <div key={n} className="flex flex-col items-center gap-3" style={{ zIndex: 1 }}>
              {/* Circle */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={
                  isDone || isActive
                    ? {
                        background: "#4edea3",
                        color: "#003824",
                        boxShadow: "0 0 20px rgba(78,222,163,0.4)",
                      }
                    : {
                        background: "#201f22",
                        color: "#bbcabf",
                        border: "1px solid #3c4a42",
                      }
                }
              >
                {isDone ? (
                  /* Check icon */
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="#003824"
                    aria-hidden="true"
                  >
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                ) : (
                  <span
                    className="font-headline font-bold text-sm"
                    style={{ lineHeight: 1 }}
                  >
                    {n}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className="text-xs font-label uppercase tracking-widest font-semibold"
                style={{
                  color: isDone || isActive ? "#4edea3" : "#bbcabf",
                  letterSpacing: "0.1em",
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
