"use client";

/**
 * useJoinWindow — is this class's classroom open yet? (SESSION-JOIN-01)
 *
 * The classroom opens `joinOpenMinutesBefore` minutes before the start
 * (booking_settings, admin-editable). Before that, the personal area's join
 * buttons are disabled and say when they open; SessionService.issueJoinToken
 * refuses the token anyway, so this is presentation, not the guard.
 *
 * One timeout per class flips `open` at the opening time (re-armed in steps for
 * classes weeks away: setTimeout overflows past ~24.8 days and would fire at once).
 * Reads the schedule from `CommerceProviders` (mounted on /area-personal); outside
 * it, `joinOpensAtMs` falls back to the default minutes.
 */

import { useEffect, useState } from "react";
import { useScheduleConfigOptional } from "@/components/booking/ScheduleProvider";
import { joinOpensAtMs } from "@/lib/booking-config";

/** Longest single wait; past it the check re-arms itself. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export function useJoinWindow(startsAt: string): { open: boolean; opensAtIso: string } {
  const config    = useScheduleConfigOptional();
  const opensAtMs = joinOpensAtMs(startsAt, config ?? {});
  const [open, setOpen] = useState(() => Date.now() >= opensAtMs);

  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const check = () => {
      const msLeft = opensAtMs - Date.now();
      setOpen(msLeft <= 0);
      if (msLeft > 0) id = setTimeout(check, Math.min(msLeft, MAX_TIMEOUT_MS));
    };
    id = setTimeout(check, 0);
    return () => clearTimeout(id);
  }, [opensAtMs]);

  return { open, opensAtIso: new Date(opensAtMs).toISOString() };
}
