"use client";

/*
 * REDESIGN-P1-01 (amended 2026-09-17) — the home hero's two CTAs.
 *
 * Buttons dispatching the shell's events, verbatim what `HeroSection.tsx` (Mentoría) dispatches:
 * the booking opens IN PLACE on `/` — the calendar for «Ver disponibilidad», the smart-book
 * surface (SignInGate signed out; the wizard or the pack booking signed in) for «Reservar
 * sesión ahora». Until P1-04 the shell on `/` hears them; after it, `BookingOverlays` (P1-06)
 * does. Not links into `/mentoria?book=…` (the original P1-01 spec): that detoured the visitor
 * through Mentoría to reach a screen that is an overlay anyway — see `PLAN.md` «Amendments».
 *
 * A leaf client island: the CTA row (`#hero-cta-row`, which `Chat.tsx` watches) and everything
 * around it stay in the Server Component.
 */

import { useTranslations } from "next-intl";

export default function HomeHeroCtas() {
  const t = useTranslations("landing.hero.cta");

  return (
    <>
      <button
        type="button"
        className="home-hero-cta home-hero-cta--primary"
        onClick={() => window.dispatchEvent(new CustomEvent("open-smart-book"))}
      >
        {t("book")}
      </button>
      <button
        type="button"
        className="home-hero-cta home-hero-cta--secondary"
        onClick={() => window.dispatchEvent(new CustomEvent("open-availability-modal"))}
      >
        {t("availability")}
      </button>
    </>
  );
}
