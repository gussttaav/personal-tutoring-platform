/*
 * REDESIGN-P1-04 — the closing booking band: heading, body, «Reservar sesión ahora» and
 * «Pregunta al asistente IA». `docs/redesign/design/home.html` `.cta-band` is the reference:
 * the surface, the bloom, `.btn-primary` and `.btn-ghost`. Its surface is the one
 * `CourseCta.tsx` draws inline for the course landings (24px radius, green-mid border, the
 * gradient fill, the bloom); this component owns the values from here on so both pages share
 * one implementation (`/mentoria` mounts it if P2-03 decides so).
 *
 * Server Component: everything single-valued is inline; the rules an inline style cannot
 * express — the 640 flip of the button row, the phone padding, the buttons' `:hover` — live in
 * the `<style>` block below, so the band carries its own rules onto any page (the page-level
 * `home.css` only spaces it, `.home-closing`). The buttons are `ClosingCtaButtons`, the one
 * client island. The primary's hover matches the hero's (`.home-hero-cta--primary`), the same
 * button on the same page.
 */

import { getTranslations } from "next-intl/server";
import ClosingCtaButtons from "./ClosingCtaButtons";

interface ClosingCtaProps {
  locale: string;
}

export default async function ClosingCta({ locale }: ClosingCtaProps) {
  const t = await getTranslations({ locale, namespace: "home.closing" });

  return (
    <div
      className="closing-cta"
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "24px",
        border: "1px solid var(--green-mid)",
        background: "linear-gradient(135deg, rgba(78,222,163,0.08) 0%, rgba(16,185,129,0.04) 100%)",
        textAlign: "center",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "-120px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "520px",
          height: "240px",
          background: "radial-gradient(circle at 50% 100%, rgba(78,222,163,0.12) 0%, rgba(19,19,21,0) 68%)",
          pointerEvents: "none",
        }}
      />

      <h2
        style={{
          position: "relative",
          fontFamily: "var(--font-headline, Manrope), sans-serif",
          fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          color: "#e5e1e4",
          margin: "0 0 14px",
        }}
      >
        {t("heading")}
      </h2>

      <p
        style={{
          position: "relative",
          fontSize: "1rem",
          lineHeight: 1.65,
          color: "#bbcabf",
          maxWidth: "560px",
          margin: "0 auto 28px",
        }}
      >
        {t("body")}
      </p>

      <div className="closing-cta-actions">
        <ClosingCtaButtons />
      </div>

      <style>{`
        .closing-cta { padding: 48px 40px; }
        @media (max-width: 639px) { .closing-cta { padding: 36px 22px; } }

        .closing-cta-actions {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
        }
        @media (min-width: 640px) {
          .closing-cta-actions {
            flex-direction: row;
            justify-content: center;
            align-items: center;
            gap: 14px;
          }
        }

        .closing-cta-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-family: var(--font-headline, Manrope), sans-serif;
          line-height: 1.5;
          white-space: nowrap;
        }
        .closing-cta-btn--primary {
          padding: 16px 36px;
          border: 0;
          border-radius: 10px;
          background: linear-gradient(135deg, #4edea3, #10b981);
          color: #003824;
          font-size: 1rem;
          font-weight: 700;
          box-shadow: 0 8px 32px rgba(78, 222, 163, 0.25);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .closing-cta-btn--primary:hover {
          color: #003824;
          transform: scale(1.02);
          box-shadow: 0 12px 40px rgba(78, 222, 163, 0.4);
        }
        .closing-cta-btn--ghost {
          padding: 16px 34px;
          border: 1px solid var(--border-variant);
          border-radius: 11px;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.95rem;
          font-weight: 600;
          transition: color 0.2s;
        }
        .closing-cta-btn--ghost:hover { color: var(--text); }

        @media (prefers-reduced-motion: reduce) {
          .closing-cta-btn--primary { transition: none; }
          .closing-cta-btn--primary:hover { transform: none; }
        }
      `}</style>
    </div>
  );
}
