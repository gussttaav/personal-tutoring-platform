"use client";

/*
 * REDESIGN-P1-04 — the chat FAB on `/`, now that `InteractiveShell` (which rendered `<Chat />`)
 * lives on `/mentoria` only. One FAB per page: the shell keeps rendering it there, this mounts
 * it here.
 *
 * Not a bare `<Chat />` in the page: the shell also UNMOUNTED the FAB while a booking screen
 * was up (it returned the overlay instead of the sections, and the FAB went with them — still
 * true on `/mentoria`, where the sections gate on `overlayOpen`). A page-level `<Chat />` would
 * float its z-index-1000 FAB over the wizard / pack-booking overlay (z-index 40) opened in
 * place on `/`. So this is the only child of `<BookingOverlays>` on `/`, reads the same
 * context the sections read, and renders nothing under exactly the overlays' own conditions —
 * the `overlayOpen` gate of `InteractiveShell.tsx`, verbatim. The availability modal hides the
 * FAB itself (`.chat-fab { display: none }`), the sign-in gate leaves it, as on `/mentoria`.
 */

import Chat from "@/components/Chat";
import { useBooking } from "@/features/booking/BookingProvider";

export default function HomeChat() {
  const { router, googleUser, packStudentInfo } = useBooking();

  // `BookingOverlays` renders the pack booking / the single session booking under these exact
  // conditions; while either is up the FAB is unmounted, as the sections are on /mentoria.
  const overlayOpen =
    Boolean(router.showPackBooking && packStudentInfo && googleUser?.email) ||
    Boolean(router.activeSession && googleUser?.email);

  if (overlayOpen) return null;
  return <Chat />;
}
