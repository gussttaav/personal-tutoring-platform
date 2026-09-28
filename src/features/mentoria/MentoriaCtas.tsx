"use client";

/*
 * REDESIGN-P2-01 — the Mentoría header's two CTAs, the header's one client island.
 *
 * Buttons dispatching the shell's events — `open-smart-book` (SignInGate signed out; the wizard
 * or the pack booking signed in) and `open-availability-modal` (the weekly calendar) — exactly
 * what the deleted `HeroSection` dispatched and what `HomeHeroCtas` dispatches on `/`. The shell
 * (`BookingOverlays`) is on this very page, so the booking opens in place: no navigation, URL
 * unchanged. Labels are existing copy (`landing.hero.cta.*`); the row around them
 * (`#hero-cta-row`, which `Chat.tsx` watches to keep the FAB clear) stays in the Server
 * Component. Styles are `mentoria.css`'s `.mt-cta*`.
 */

import { useTranslations } from "next-intl";

export default function MentoriaCtas() {
  const t = useTranslations("landing.hero.cta");

  return (
    <>
      <button
        type="button"
        className="mt-cta mt-cta--primary"
        onClick={() => window.dispatchEvent(new CustomEvent("open-smart-book"))}
      >
        {t("book")}
      </button>
      <button
        type="button"
        className="mt-cta mt-cta--secondary"
        onClick={() => window.dispatchEvent(new CustomEvent("open-availability-modal"))}
      >
        {t("availability")}
      </button>
    </>
  );
}
