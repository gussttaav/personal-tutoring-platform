"use client";

/**
 * RescheduleBridge — wires `/mentoria?reschedule=…&token=…` into the booking router.
 *
 * REDESIGN-P1-06: `useRescheduleIntent` is the one `useSearchParams()` in the booking code —
 * the reason the shell needed a `Suspense` boundary. It must not reach `/` (P1-04 wants the
 * home static), so it no longer sits next to `useBookingRouter` in the provider: this
 * render-nothing component holds it, and only `InteractiveShell` (Mentoría's sections, inside
 * Mentoría's `Suspense`) mounts it. The two wiring effects are the shell's `:99-112`, moved
 * verbatim; the third publishes the reschedule sign-in label + callbackUrl to the provider's
 * `rescheduleGate` atom, which `BookingOverlays`' sign-in gate merges with the router's own
 * state exactly as the shell's `combinedSignInLabel` / `combinedCallbackUrl` did.
 */

import { useEffect } from "react";
import { useRescheduleIntent } from "@/hooks/useRescheduleIntent";
import { useBooking } from "./BookingProvider";

export default function RescheduleBridge() {
  const { router, isSignedIn, setRescheduleGate } = useBooking();
  const reschedule = useRescheduleIntent(isSignedIn);

  // Wire reschedule intent into the router once it resolves
  useEffect(() => {
    if (!reschedule.activeReschedule) return;
    const { type, token } = reschedule.activeReschedule;
    router.applyReschedule(type, token);
    reschedule.clearPendingReschedule();
  }, [reschedule.activeReschedule]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge the reschedule sign-in label into the router's gate state
  useEffect(() => {
    if (reschedule.signInLabel) {
      router.setRescheduleSignInLabel(reschedule.signInLabel);
    }
  }, [reschedule.signInLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Publish the reschedule gate (label + OAuth callbackUrl + clear) for the sign-in gate render.
  // Mirrors `reschedule.signInLabel` / `pendingReschedule`: set while a reschedule link waits
  // for sign-in, null once it's applied or dismissed.
  useEffect(() => {
    setRescheduleGate(
      reschedule.signInLabel
        ? {
            label:       reschedule.signInLabel,
            callbackUrl: reschedule.pendingReschedule?.callbackUrl,
            clear:       reschedule.clearPendingReschedule,
          }
        : null,
    );
  }, [reschedule.signInLabel, reschedule.pendingReschedule]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
