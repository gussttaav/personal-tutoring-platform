"use client";

/*
 * REDESIGN-P1-04 — the closing band's two buttons, the band's one client island.
 *
 * «Reservar sesión ahora» dispatches `open-smart-book`, exactly what the home hero's primary
 * (`HomeHeroCtas`) dispatches, so the booking opens IN PLACE on whichever page mounts the band
 * — `BookingOverlays` hears it on both. Not a `<Link href="/mentoria?book=smart">` (the task's
 * original spec): the overlays are on both pages since P1-06, so the detour is gone.
 * «Pregunta al asistente IA» dispatches `open-chat`, the footer's event, heard by `Chat`.
 *
 * Labels are existing copy (`landing.hero.cta.book`, `footer.askAssistant`) — the band adds
 * no button keys. Styles are `ClosingCta`'s (`.closing-cta-btn*`).
 */

import { useTranslations } from "next-intl";

export default function ClosingCtaButtons() {
  const tCta = useTranslations("landing.hero.cta");
  const tFooter = useTranslations("footer");

  return (
    <>
      <button
        type="button"
        className="closing-cta-btn closing-cta-btn--primary"
        onClick={() => window.dispatchEvent(new CustomEvent("open-smart-book"))}
      >
        {tCta("book")}
      </button>
      <button
        type="button"
        className="closing-cta-btn closing-cta-btn--ghost"
        onClick={() => window.dispatchEvent(new Event("open-chat"))}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#4edea3" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {tFooter("askAssistant")}
      </button>
    </>
  );
}
