// CHAT-AGENT-P3-02: which of the assistant's slot chips fit the visitor's own calendar.
// Pure: the busy intervals come from Google's freeBusy, read in the browser
// (src/lib/google-calendar-freebusy.ts), and never leave it.

export interface TimeInterval {
  start: string;
  end:   string;
}

/**
 * Keeps the slots that overlap no busy interval. Touching edges don't overlap: a slot that
 * ends when a meeting starts (or starts when one ends) survives. An interval that doesn't
 * parse is ignored rather than hiding every slot.
 */
export function filterSlotsByBusy<S extends { startIso: string; endIso: string }>(
  slots: S[],
  busy:  TimeInterval[],
): S[] {
  const blocks = busy
    .map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start);

  return slots.filter((s) => {
    const start = Date.parse(s.startIso);
    const end   = Date.parse(s.endIso);
    return blocks.every((b) => start >= b.end || end <= b.start);
  });
}
