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
 *
 * BOOKING-STEPS-01: the button is `BookingExitButton` now, and this row only shows where nothing
 * else carries it — the wizard's success and error screens. The wizard's steps draw it inside
 * `WizardProgress` (left of the steps), and the pack screen below its sidebar.
 */

import { useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookingExitButton from "@/components/booking/BookingExitButton";

interface BookingLayoutProps {
  children: React.ReactNode;
  /** Scrolls the overlay back to the top whenever this value changes. Pass the
   *  wizard step/phase so a new screen always starts from the top — the overlay
   *  div is reused across steps, so its scrollTop would otherwise carry over. */
  scrollResetKey?: string;
  /** Leaves the booking (closes the overlay in place). Renders the exit bar — only for screens
   *  with no other exit (the wizard's success and error; BOOKING-STEPS-01). */
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
            <BookingExitButton onClick={onExit} disabled={exitDisabled} variant={exitVariant} />
          </div>
        )}

        {children}
      </main>

      <Footer />
    </div>
  );
}
