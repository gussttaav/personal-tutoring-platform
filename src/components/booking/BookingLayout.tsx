"use client";

/**
 * BookingLayout — full-page overlay wrapper for booking flows
 *
 * Replaces FullScreenShell. Uses position:fixed overlay so no routing changes
 * are needed. Renders the actual Navbar and Footer for visual consistency with
 * the landing page (matches booking.html layout).
 */

import { useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface BookingLayoutProps {
  children: React.ReactNode;
  /** Scrolls the overlay back to the top whenever this value changes. Pass the
   *  wizard step/phase so a new screen always starts from the top — the overlay
   *  div is reused across steps, so its scrollTop would otherwise carry over. */
  scrollResetKey?: string;
}

export default function BookingLayout({ children, scrollResetKey }: BookingLayoutProps) {
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
        className="pt-20 pb-10 px-4 sm:pt-32 sm:pb-20 sm:px-6"
        style={{
          flex: 1,
          maxWidth: "1440px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {children}
      </main>

      <Footer />
    </div>
  );
}
