/**
 * @jest-environment jsdom
 */
// SESSION-JOIN-01: the personal area's join buttons stay disabled until the
// classroom opens (start − joinOpenMinutesBefore) and flip on by themselves.
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { ScheduleProvider } from "@/components/booking/ScheduleProvider";
import type { ScheduleConfig } from "@/domain/types";
import { DEFAULT_JOIN_OPEN_MINUTES } from "@/lib/booking-config";
import { useJoinWindow } from "../useJoinWindow";

const START = "2026-10-27T08:00:00.000Z";

const SCHEDULE: ScheduleConfig = {
  weeklyHours:             { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
  timezone:                "Europe/Madrid",
  minNoticeHours:          5,
  cancelMinNoticeHours:    2,
  joinOpenMinutesBefore:   10,
  tutorAbsentAlertMinutes: 5,
  bookingWindowWeeks:      8,
};

function withSchedule(config: ScheduleConfig) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ScheduleProvider value={config}>{children}</ScheduleProvider>;
  };
}

afterEach(() => jest.useRealTimers());

describe("useJoinWindow", () => {
  it("is closed before the opening time and opens on its own at it", () => {
    jest.useFakeTimers({ now: new Date("2026-10-27T07:49:00Z") });
    const { result } = renderHook(() => useJoinWindow(START), { wrapper: withSchedule(SCHEDULE) });

    expect(result.current.open).toBe(false);
    expect(result.current.opensAtIso).toBe("2026-10-27T07:50:00.000Z");

    act(() => { jest.advanceTimersByTime(59_000); });
    expect(result.current.open).toBe(false);

    act(() => { jest.advanceTimersByTime(1_000); });
    expect(result.current.open).toBe(true);
  });

  it("is open from the first render once the classroom has opened", () => {
    jest.useFakeTimers({ now: new Date("2026-10-27T07:55:00Z") });
    const { result } = renderHook(() => useJoinWindow(START), { wrapper: withSchedule(SCHEDULE) });
    expect(result.current.open).toBe(true);
  });

  it("does not open at once for a class weeks away (setTimeout overflow)", () => {
    jest.useFakeTimers({ now: new Date("2026-09-01T08:00:00Z") }); // ~8 weeks before
    const { result } = renderHook(() => useJoinWindow(START), { wrapper: withSchedule(SCHEDULE) });

    act(() => { jest.advanceTimersByTime(1_000); });
    expect(result.current.open).toBe(false);
  });

  it("falls back to the default minutes outside a ScheduleProvider", () => {
    jest.useFakeTimers({ now: new Date("2026-10-27T07:00:00Z") });
    const { result } = renderHook(() => useJoinWindow(START));
    expect(result.current.opensAtIso).toBe(
      new Date(Date.parse(START) - DEFAULT_JOIN_OPEN_MINUTES * 60_000).toISOString(),
    );
  });
});
