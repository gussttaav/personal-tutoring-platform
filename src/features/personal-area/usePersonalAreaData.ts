"use client";

/**
 * usePersonalAreaData — the three fetches behind /area-personal.
 *
 * Deliberately three independent states rather than one combined one: the tabs
 * are independent surfaces, and a history failure must not blank the page that
 * shows a student their next class. Each starts in parallel on mount so nothing
 * waterfalls behind anything else.
 *
 * Plain `fetch`, not @/lib/api-client: `request<T>` calls `res.json()`
 * unconditionally and the courses endpoint answers 204 when the session is gone
 * (same reasoning as useCourseProgress).
 */

import { useCallback, useEffect, useState } from "react";
import type { BookingHistoryEntry, EnrolledCourseView } from "@/domain/types";
import type { BookingsState, EnrollmentsState, HistoryState, UserBooking } from "./types";

/** Page size for the history endpoint — its schema caps `limit` at 50. */
const HISTORY_PAGE_SIZE = 50;

/**
 * Safety valve on the paging loop. The stat cards and the tab badge both need
 * the complete set, so the loop runs to exhaustion; this stops a pathological
 * account from issuing unbounded requests. When the cap is hit, `historyTruncated`
 * is true and the UI offers "load more" instead of "end of history".
 */
const HISTORY_MAX_PAGES = 10;

interface PersonalAreaData {
  /** Upcoming sessions only, ascending — past ones are filtered out on arrival. */
  bookingsState:     BookingsState;
  historyState:      HistoryState;
  enrollmentsState:  EnrollmentsState;
  historyTruncated:  boolean;
  /** Re-fetch upcoming bookings (after a cancel, or a retry). */
  refreshBookings:   () => void;
  /** Re-fetch history from the first page. */
  refreshHistory:    () => void;
  /** Fetch the next batch after the page cap was hit. */
  loadMoreHistory:   () => void;
  /**
   * Patch one history entry in place — used after a retroactive review so the
   * list shows the new stars without re-paging the whole endpoint.
   */
  patchHistoryEntry: (id: string, patch: Partial<BookingHistoryEntry>) => void;
}

export function usePersonalAreaData(locale: string, isAuthLoading: boolean): PersonalAreaData {
  const [bookingsState,    setBookingsState]    = useState<BookingsState>("loading");
  const [historyState,     setHistoryState]     = useState<HistoryState>("loading");
  const [enrollmentsState, setEnrollmentsState] = useState<EnrollmentsState>("loading");
  const [historyCursor,    setHistoryCursor]    = useState<string | null>(null);

  // ── Upcoming bookings ──────────────────────────────────────────────────────

  const loadBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/my-bookings");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { bookings: UserBooking[] };

      // Narrow to still-upcoming sessions here rather than during render: reading the
      // clock in a render pass is impure (react-hooks/purity), and this async
      // continuation is the natural place for it. `endsAt` not `startsAt` — a class
      // already in progress is still joinable.
      const now = Date.now();
      setBookingsState(
        data.bookings
          .filter((b) => new Date(b.endsAt).getTime() > now)
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
      );
    } catch {
      setBookingsState("error");
    }
  }, []);

  const refreshBookings = useCallback(() => {
    setBookingsState("loading");
    void loadBookings();
  }, [loadBookings]);

  // ── History (paged to exhaustion) ──────────────────────────────────────────

  const fetchHistoryPages = useCallback(
    async (startCursor: string | null): Promise<{ entries: BookingHistoryEntry[]; cursor: string | null }> => {
      const collected: BookingHistoryEntry[] = [];
      let cursor = startCursor;

      for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
        const qs = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) });
        if (cursor) qs.set("cursor", cursor);

        const res = await fetch(`/api/my-bookings/history?${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          bookings:   BookingHistoryEntry[];
          nextCursor: string | null;
        };

        collected.push(...data.bookings);
        cursor = data.nextCursor;
        if (!cursor) break;
      }

      return { entries: collected, cursor };
    },
    [],
  );

  const loadHistory = useCallback(async () => {
    try {
      const { entries, cursor } = await fetchHistoryPages(null);
      setHistoryState(entries);
      setHistoryCursor(cursor);
    } catch {
      setHistoryState("error");
    }
  }, [fetchHistoryPages]);

  const refreshHistory = useCallback(() => {
    setHistoryState("loading");
    setHistoryCursor(null);
    void loadHistory();
  }, [loadHistory]);

  const loadMoreHistory = useCallback(() => {
    if (!historyCursor) return;
    void (async () => {
      try {
        const { entries, cursor } = await fetchHistoryPages(historyCursor);
        setHistoryState((prev) => (Array.isArray(prev) ? [...prev, ...entries] : entries));
        setHistoryCursor(cursor);
      } catch {
        // Keep what is already on screen — a failed "load more" must not discard it.
        setHistoryCursor(null);
      }
    })();
  }, [historyCursor, fetchHistoryPages]);

  const patchHistoryEntry = useCallback((id: string, patch: Partial<BookingHistoryEntry>) => {
    setHistoryState((prev) =>
      Array.isArray(prev) ? prev.map((e) => (e.id === id ? { ...e, ...patch } : e)) : prev,
    );
  }, []);

  // ── Enrolled courses ───────────────────────────────────────────────────────

  const loadEnrollments = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/progress?locale=${encodeURIComponent(locale)}`);
      // 204 = signed out under an open tab; anything else non-OK is a failure.
      // Both hide the tab rather than shouting about it.
      if (!res.ok || res.status === 204) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { enrollments?: EnrolledCourseView[] };
      setEnrollmentsState(data.enrollments ?? "hidden");
    } catch {
      setEnrollmentsState("hidden");
    }
  }, [locale]);

  // ── Kick everything off once auth resolves ─────────────────────────────────
  // Every loader sets state only in its async continuation (after the await), so
  // nothing is set synchronously inside the effect.

  useEffect(() => {
    if (isAuthLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loaders set state after their fetch resolves, never synchronously here.
    void loadBookings();
    void loadHistory();
    void loadEnrollments();
  }, [isAuthLoading, loadBookings, loadHistory, loadEnrollments]);

  return {
    bookingsState,
    historyState,
    enrollmentsState,
    historyTruncated: historyCursor !== null,
    refreshBookings,
    refreshHistory,
    loadMoreHistory,
    patchHistoryEntry,
  };
}
