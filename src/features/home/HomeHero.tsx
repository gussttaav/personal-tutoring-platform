/*
 * REDESIGN-P1-01 — the home (/) hero: identity line, credential, two-line headline with the
 * gradient second line, subheading, the two booking CTAs, the free-meeting note, the photo and
 * the four stats. `docs/redesign/design/home.html` `.hero` is the reference.
 *
 * Server Component: everything here is static HTML except `HomeStats` (the popovers hold
 * state), so the boundary sits there and the hero ships no client JS of its own.
 *
 * The CTAs are `HomeHeroCtas`, a client island of two buttons dispatching `open-smart-book` /
 * `open-availability-modal` — the same events `HeroSection` (Mentoría) dispatches — so the
 * calendar and the booking open in place on `/` (plan amendment of 2026-09-17; the original
 * spec linked into `/mentoria?book=…`). The `book=availability` deep-link case the shell gained
 * in this task stays for external callers.
 *
 * The photo frame moved up from the bio (`BiographySection.tsx`, which loses it in P1-02): one
 * `<Image>` whose wrapper is the 128px glow box above the text below 1024 and the 4/5 offset
 * frame beside it from 1024 (`home.css`), hence the two-part `sizes`. `#hero-cta-row` stays on
 * the CTA row: `Chat.tsx` watches it to keep the FAB out of the buttons' way.
 */

import Image from "next/image";
import { getTranslations } from "next-intl/server";
import HomeStats from "./HomeStats";
import HomeHeroCtas from "./HomeHeroCtas";

interface HomeHeroProps {
  locale: string;
}

export default async function HomeHero({ locale }: HomeHeroProps) {
  const t = await getTranslations({ locale, namespace: "home.hero" });
  const tLanding = await getTranslations({ locale, namespace: "landing.hero" });

  return (
    <section
      style={{
        paddingTop: "100px",
        paddingBottom: "40px",
        animation: "fadeUp 0.7s ease both",
      }}
    >
      <div className="home-hero-grid">
        <div className="home-hero-copy">
          {/* ── Identity ── */}
          <p
            style={{
              fontSize: "0.875rem",
              fontWeight: 700,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "#4edea3",
              marginBottom: "8px",
            }}
          >
            Gustavo Torres Guerrero
          </p>
          <p style={{ fontSize: "0.9rem", color: "#86948a", fontWeight: 400, marginBottom: "20px" }}>
            {tLanding("credential")}
          </p>

          {/* ── Headline ── */}
          <h1
            style={{
              fontFamily: "var(--font-headline, Manrope), sans-serif",
              fontSize: "clamp(2.4rem, 5.2vw, 4rem)",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "#e5e1e4",
              marginBottom: "22px",
              textWrap: "balance",
            }}
          >
            {t("headline1")}
            <span
              style={{
                display: "block",
                background: "linear-gradient(135deg, #4edea3, #10b981)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                // background-clip:text paints only inside the box; the tight
                // line-height clips descenders (g, p, y). Extend the box and
                // pull it back so surrounding layout is unchanged.
                paddingBottom: "0.15em",
                marginBottom: "-0.15em",
              }}
            >
              {t("headline2")}
            </span>
          </h1>

          {/* ── Subheading ── */}
          <p
            style={{
              fontSize: "1.1rem",
              lineHeight: 1.7,
              color: "#e5e1e4",
              fontWeight: 500,
              maxWidth: "600px",
              marginBottom: "32px",
              textWrap: "pretty",
            }}
          >
            {t("subheading")}
          </p>

          {/* ── CTAs ── */}
          <div id="hero-cta-row" className="hero-cta-row home-hero-cta-row" style={{ gap: "16px" }}>
            <HomeHeroCtas />
          </div>

          {/* ── Free-meeting note ── */}
          <p
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "18px",
              fontSize: "13px",
              color: "#86948a",
            }}
          >
            <span
              aria-hidden="true"
              style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4edea3", flexShrink: 0 }}
            />
            {t("freeNote")}
          </p>
        </div>

        {/* ── Photo: glow box below 1024, offset frame above (home.css) ── */}
        <div className="home-hero-photo">
          <div className="home-hero-frame">
            <div className="home-hero-halo" aria-hidden="true" />

            {/* Accent dot */}
            <div
              className="home-hero-frame-deco"
              aria-hidden="true"
              style={{
                position: "absolute", top: "-10px", left: "-10px",
                width: "22px", height: "22px", borderRadius: "50%",
                background: "#4edea3", opacity: 0.7, zIndex: 3,
              }}
            />
            {/* Accent line */}
            <div
              className="home-hero-frame-deco"
              aria-hidden="true"
              style={{
                position: "absolute", top: "24px", left: "-10px",
                width: "3px", height: "40px", borderRadius: "2px",
                background: "#4edea3", opacity: 0.4, zIndex: 3,
              }}
            />
            {/* Offset background blocks */}
            <div
              className="home-hero-frame-deco"
              aria-hidden="true"
              style={{
                position: "absolute", bottom: "-7px", right: "-7px",
                width: "85%", height: "85%", borderRadius: "14px",
                background: "#4edea3", opacity: 0.12,
              }}
            />
            <div
              className="home-hero-frame-deco"
              aria-hidden="true"
              style={{
                position: "absolute", bottom: "-14px", right: "-14px",
                width: "85%", height: "85%", borderRadius: "14px",
                background: "#4edea3", opacity: 0.25,
              }}
            />

            {/* Photo */}
            <div className="home-hero-picture">
              <Image
                src="/avatar.png"
                alt="Gustavo Torres Guerrero"
                fill
                style={{ objectFit: "cover" }}
                sizes="(max-width: 1023px) 128px, 340px"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      <HomeStats />
    </section>
  );
}
