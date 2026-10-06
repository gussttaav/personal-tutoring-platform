/**
 * @jest-environment jsdom
 */
// BOOKING-EXIT-01: the wizard's session-type switch changes the atom size of a mounted
// calendar. The cache holds one atom size, so a change must refetch the visible week instead
// of keeping the old size's days (the skip-loaded check used to keep them).
import { renderHook, waitFor } from "@testing-library/react";
import { useWeekAvailability } from "@/hooks/useWeekAvailability";
import type { WeeklyHours } from "@/domain/types";

const WEEKDAY_HOURS = [{ start: "09:00", end: "18:00" }];
const WEEKLY_HOURS = { 1: WEEKDAY_HOURS, 2: WEEKDAY_HOURS, 3: WEEKDAY_HOURS, 4: WEEKDAY_HOURS, 5: WEEKDAY_HOURS } as unknown as WeeklyHours;

function nextMonday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d;
}

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve({ json: () => Promise.resolve({ slots: [] }) }));
  global.fetch = fetchMock as unknown as typeof fetch;
});

function durations(): string[] {
  return fetchMock.mock.calls.map(([url]) => new URL(url as string, "http://x").searchParams.get("duration") ?? "");
}

describe("useWeekAvailability", () => {
  const weekStart = nextMonday();
  const base = {
    weekStart,
    userTz:             "Europe/Madrid",
    weeklyHours:        WEEKLY_HOURS,
    bookingWindowWeeks: 8,
    resetKey:           "0",
  };

  it("refetches the loaded week when the atom size changes", async () => {
    const { rerender, result } = renderHook((props: { atomicMinutes: number }) =>
      useWeekAvailability({ ...base, ...props }), { initialProps: { atomicMinutes: 30 } });

    await waitFor(() => expect(Object.values(result.current.slotsMap).every((v) => Array.isArray(v))).toBe(true));
    const firstRound = fetchMock.mock.calls.length;
    expect(firstRound).toBe(5); // Monday–Friday
    expect(durations().every((d) => d === "30")).toBe(true);

    rerender({ atomicMinutes: 15 });
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(firstRound * 2));
    expect(durations().slice(firstRound).every((d) => d === "15")).toBe(true);
  });

  it("keeps the loaded week when nothing that shapes the data changed", async () => {
    const { rerender, result } = renderHook((props: { atomicMinutes: number }) =>
      useWeekAvailability({ ...base, ...props }), { initialProps: { atomicMinutes: 30 } });

    await waitFor(() => expect(Object.values(result.current.slotsMap).every((v) => Array.isArray(v))).toBe(true));
    const calls = fetchMock.mock.calls.length;

    rerender({ atomicMinutes: 30 });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock.mock.calls.length).toBe(calls);
  });
});
