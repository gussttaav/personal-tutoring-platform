"use client";

/**
 * BookingLayout — full-page overlay wrapper for booking flows
 *
 * Replaces FullScreenShell. Uses position:fixed overlay so no routing changes
 * are needed. Renders the actual Navbar and Footer for visual consistency with
 * the landing page (matches booking.html layout).
 *
 * BOOKING-EXIT-01: the layout draws the booking's one exit — «✕ Salir de la reserva», top-left,
 * the same control on every screen (calendar, review, payment, error; «Cerrar» on success) of
 * both flows. It used to be «Cambiar tipo de sesión» at the bottom of the calendar card only:
 * absent from every other step, and below the fold on a phone. ✕ (leave the flow) is kept apart
 * from the ← of «Volver atrás» (previous step). Styled like the calendar's week buttons: a
 * secondary control that is easy to find and never competes with the step's primary action.
 */

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface BookingLayoutProps {
  children: React.ReactNode;
  /** Scrolls the overlay back to the top whenever this value changes. Pass the
   *  wizard step/phase so a new screen always starts from the top — the overlay
   *  div is reused across steps, so its scrollTop would otherwise carry over. */
  scrollResetKey?: string;
  /** Leaves the booking (closes the overlay in place). Renders the exit bar. */
  onExit?: () => void;
  /** «Salir de la reserva» while booking; «Cerrar» once there is nothing left to abandon. */
  exitVariant?: "exit" | "close";
  /** True while a booking request is in flight — leaving would hide its outcome. */
  exitDisabled?: boolean;
}

export default function BookingLayout({
  children,
  scrollResetKey,
  onExit,
  exitVariant = "exit",
  exitDisabled = false,
}: BookingLayoutProps) {
  const t = useTranslations("booking.layout");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Hide the document scrollbar while the overlay is mounted so only the
  // overlay's own scrollbar is visible (globals.css sets overflow-y:scroll
  // on <html>, which would otherwise show a second, non-functional scrollbar).
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflowY;
    html.style.overflowY = "hidden";
    return () => {
      html.style.overflowY = prev;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [scrollResetKey]);

  return (
    <div
      ref={scrollRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: "#131315",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Navbar />

      <main
        className="pt-24 pb-10 px-4 sm:pb-20 sm:px-6"
        style={{
          flex: 1,
          maxWidth: "1440px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {onExit && (
          <div className="mb-4 sm:mb-8">
            <button
              type="button"
              onClick={onExit}
              disabled={exitDisabled}
              className="inline-flex items-center gap-2 h-10 pl-3 pr-4 rounded-lg text-sm font-semibold transition-colors bg-[#201f22] border border-[#3c4a42] text-[#bbcabf] enabled:hover:bg-[#2a2a2c] enabled:hover:text-[#e5e1e4] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
                close
              </span>
              {exitVariant === "close" ? t("close") : t("exit")}
            </button>
          </div>
        )}

        {children}
      </main>

      <Footer />
    </div>
  );
}
