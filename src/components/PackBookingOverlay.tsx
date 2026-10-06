"use client";

/**
 * PackBookingOverlay
 *
 * Listens for the "open-pack-booking" custom event dispatched by the Navbar
 * and renders the full pack-scheduling flow via BookingModeView (which wraps
 * itself in BookingLayout — a position:fixed full-screen overlay with its own
 * Navbar).
 *
 * No custom wrapper div is used here — BookingLayout takes full control of the
 * screen so there is no stacking-context conflict.
 *
 * BOOKING-EXIT-01: the screen answers back and the site links like the booking screens on `/`,
 * `/mentoria` and `/area-personal` do (`useBookingHistory`): one history entry while it shows,
 * popped on close. The hook also handles «close-booking-overlay», which this component used to
 * listen for itself (the logo only); every Navbar / Footer link sends it now.
 */

import { useEffect, useState } from "react";
import { useUserSession } from "@/hooks/useUserSession";
import { useBookingHistory } from "@/hooks/useBookingHistory";
import BookingModeView from "@/components/BookingModeView";

export default function PackBookingOverlay() {
  const [show, setShow] = useState(false);
  const { googleUser, packSession, updateCredits } = useUserSession();

  useEffect(() => {
    const openHandler = () => setShow(true);
    window.addEventListener("open-pack-booking", openHandler);
    return () => window.removeEventListener("open-pack-booking", openHandler);
  }, []);

  // The same condition the render below uses, so the entry exists exactly while the screen does.
  useBookingHistory(show && !!packSession && !!googleUser?.email, () => setShow(false));

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
