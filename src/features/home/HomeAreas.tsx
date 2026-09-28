/*
 * REDESIGN-P1-02 — the home (/) compact areas grid: a one-line summary of the six areas the
 * `/mentoria` bento (`SpecializationsSection.tsx`) covers in full — same icons and titles
 * (`landing.specs.cards.<k>.title`), no tags, no DAM/DAW CTA. `landing.specs.headline` («Áreas
 * de Especialización») doubles as this band's overline (styled small, per the design; not a new
 * key). `docs/redesign/design/home.html` `.exp-grid` / `.exp` is the reference — 12px gaps, not
 * the bento's 16px.
 *
 * Server Component: icons render from the self-hosted Material Symbols font, like the bento.
 */

import { getTranslations } from "next-intl/server";

interface HomeAreasProps {
  locale: string;
}

const AREAS = [
  { key: "programming", icon: "code" },
  { key: "backend", icon: "dns" },
  { key: "math", icon: "calculate" },
  { key: "ai", icon: "psychology" },
  { key: "data", icon: "analytics" },
  { key: "cycles", icon: "school" },
] as const;

export default async function HomeAreas({ locale }: HomeAreasProps) {
  const tSpecs = await getTranslations({ locale, namespace: "landing.specs" });
  const t = await getTranslations({ locale, namespace: "home.areas" });

  return (
    <div>
      <p
        style={{
          fontSize: "15px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#4edea3",
          marginBottom: "16px",
        }}
      >
        {tSpecs("headline")}
      </p>

      <div className="home-areas-grid">
        {AREAS.map(({ key, icon }) => (
          <div key={key} className="home-area">
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "rgba(78,222,163,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#4edea3" }}>
                {icon}
              </span>
            </div>
            <div>
              <h3
                style={{
                  fontFamily: "var(--font-headline, Manrope), sans-serif",
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                  color: "#e5e1e4",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.25,
                  marginBottom: "5px",
                }}
              >
                {tSpecs(`cards.${key}.title`)}
              </h3>
              <p style={{ fontSize: "0.8125rem", lineHeight: 1.55, color: "#86948a", margin: 0 }}>
                {t(key)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
