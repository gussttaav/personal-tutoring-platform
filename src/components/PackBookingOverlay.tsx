"use client";

/**
 * PackBookingOverlay
 *
 * Listens for the "open-pack-booking" custom event dispatched by the Navbar
 * and renders the full pack-scheduling flow via BookingModeView (which wraps
 * itself in BookingLayout — a position:fixed full-screen overlay with its own
 * Navbar). Also listens for "close-booking-overlay" so the Navbar logo click
 * closes the overlay, matching the InteractiveShell behaviour on the home page.
 *
 * No custom wrapper div is used here — BookingLayout takes full control of the
 * screen so there is no stacking-context conflict.
 */

import { useEffect, useState } from "react";
import { useUserSession } from "@/hooks/useUserSession";
import BookingModeView from "@/components/BookingModeView";

export default function PackBookingOverlay() {
  const [show, setShow] = useState(false);
  const { googleUser, packSession, updateCredits } = useUserSession();

  useEffect(() => {
    const openHandler  = () => setShow(true);
    const closeHandler = () => setShow(false);
    window.addEventListener("open-pack-booking",      openHandler);
    window.addEventListener("close-booking-overlay",  closeHandler);
    return () => {
      window.removeEventListener("open-pack-booking",     openHandler);
      window.removeEventListener("close-booking-overlay", closeHandler);
    };
  }, []);

  if (!show || !packSession || !googleUser?.email) return null;

  const packStudentInfo = {
    email:   packSession.email,
    name:    packSession.name,
    credits: packSession.credits,
  };

  return (
    <BookingModeView
      student={packStudentInfo}
      rescheduleToken={null}
      onCreditsUpdated={updateCredits}
      onExit={() => setShow(false)}
      packTotal={packSession.packSize}
    />
  );
}
