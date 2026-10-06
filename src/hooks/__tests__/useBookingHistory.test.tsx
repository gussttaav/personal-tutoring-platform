/**
 * @jest-environment jsdom
 */
// BOOKING-EXIT-01: a booking surface owns ONE same-URL history entry. Back closes it, a close
// from the UI pops it, and a site link (`requestBookingExit`) is handled by the open booking:
// the current page closes in place, another page replaces the entry.
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";

let mockPathname = "/mentoria";
const mockPush    = jest.fn();
const mockReplace = jest.fn();
jest.mock("@/i18n/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter:   () => ({ push: mockPush, replace: mockReplace }),
}));

import { isBookingEntryOnTop, useBookingHistory } from "@/hooks/useBookingHistory";
import { CLOSE_BOOKING_EVENT, requestBookingExit } from "@/lib/booking-exit";

/** Resolves on the next popstate (history.back() is asynchronous in jsdom, as in browsers). */
function nextPopState(): Promise<void> {
  return new Promise((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
}

function dispatchExit(href: string): CustomEvent {
  const event = new CustomEvent(CLOSE_BOOKING_EVENT, { cancelable: true, detail: { href } });
  act(() => { window.dispatchEvent(event); });
  return event;
}

beforeEach(() => {
  mockPathname = "/mentoria";
  mockPush.mockReset();
  mockReplace.mockReset();
  // Every test starts on a plain (unmarked) entry.
  window.history.pushState(null, "");
  jest.restoreAllMocks();
});

describe("useBookingHistory", () => {
  it("pushes one entry when a surface opens and none while it stays open", () => {
    const close = jest.fn();
    const before = window.history.length;
    const { rerender } = renderHook(({ open }) => useBookingHistory(open, close), {
      initialProps: { open: false },
    });
    expect(window.history.length).toBe(before);

    rerender({ open: true });
    expect(window.history.length).toBe(before + 1);
    expect(isBookingEntryOnTop()).toBe(true);

    rerender({ open: true });
    expect(window.history.length).toBe(before + 1);
    expect(close).not.toHaveBeenCalled();
  });

  it("reuses an entry that is already on top instead of stacking a second one", () => {
    window.history.pushState({ __bookingOverlay: true }, "");
    const before = window.history.length;
    renderHook(() => useBookingHistory(true, jest.fn()));
    expect(window.history.length).toBe(before);
  });

  it("closes the surface when the visitor goes back", async () => {
    const close = jest.fn();
    renderHook(() => useBookingHistory(true, close));
    expect(isBookingEntryOnTop()).toBe(true);

    const popped = nextPopState();
    window.history.back();
    await act(async () => { await popped; });

    expect(close).toHaveBeenCalledTimes(1);
    expect(isBookingEntryOnTop()).toBe(false);
  });

  it("pops its entry when the surface is closed from the UI", async () => {
    const close = jest.fn();
    const back  = jest.spyOn(window.history, "back");
    const { rerender } = renderHook(({ open }) => useBookingHistory(open, close), {
      initialProps: { open: true },
    });

    const popped = nextPopState();
    rerender({ open: false });
    expect(back).toHaveBeenCalledTimes(1);
    await act(async () => { await popped; });

    expect(isBookingEntryOnTop()).toBe(false);
    // The UI already closed it: the pop must not call close() a second time.
    expect(close).not.toHaveBeenCalled();
  });

  it("re-pushes after the pop lands when the surface reopens mid-pop", async () => {
    const close = jest.fn();
    const { rerender } = renderHook(({ open }) => useBookingHistory(open, close), {
      initialProps: { open: true },
    });

    const popped = nextPopState();
    rerender({ open: false });
    rerender({ open: true }); // e.g. availability modal → wizard while the history loads
    await act(async () => { await popped; });

    await waitFor(() => expect(isBookingEntryOnTop()).toBe(true));
    expect(close).not.toHaveBeenCalled();
  });

  it("leaves the history alone when it unmounts with the page", () => {
    const back = jest.spyOn(window.history, "back");
    const { unmount } = renderHook(() => useBookingHistory(true, jest.fn()));
    unmount();
    expect(back).not.toHaveBeenCalled();
  });

  it("closes in place when a link points at the current page", () => {
    const close = jest.fn();
    renderHook(() => useBookingHistory(true, close));

    const event = dispatchExit("/mentoria");
    expect(event.defaultPrevented).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("replaces its entry when a link leaves for another page", () => {
    const close = jest.fn();
    renderHook(() => useBookingHistory(true, close));

    const event = dispatchExit("/cursos");
    expect(event.defaultPrevented).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith("/cursos");
    expect(mockPush).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("pushes instead when its entry is no longer on top", () => {
    renderHook(() => useBookingHistory(true, jest.fn()));
    window.history.replaceState(null, ""); // e.g. a third party rewrote the entry

    dispatchExit("/blog");
    expect(mockPush).toHaveBeenCalledWith("/blog");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("ignores links while nothing is open", () => {
    const close = jest.fn();
    renderHook(() => useBookingHistory(false, close));

    const event = dispatchExit("/mentoria");
    expect(event.defaultPrevented).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });
});

describe("requestBookingExit", () => {
  function TestLink({ href }: { href: string }) {
    return <a href={href} onClick={(e) => requestBookingExit(e, href)}>link</a>;
  }

  it("lets the link navigate when no booking answers", () => {
    render(<TestLink href="/cursos" />);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    screen.getByText("link").dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
  });

  it("cancels the link when an open booking takes the trip", () => {
    const close = jest.fn();
    renderHook(() => useBookingHistory(true, close));
    render(<TestLink href="/mentoria" />);

    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    act(() => { screen.getByText("link").dispatchEvent(click); });
    expect(click.defaultPrevented).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("leaves new-tab clicks (modifier keys) to the browser", () => {
    const close = jest.fn();
    renderHook(() => useBookingHistory(true, close));
    render(<TestLink href="/mentoria" />);

    fireEvent.click(screen.getByText("link"), { ctrlKey: true });
    fireEvent.click(screen.getByText("link"), { metaKey: true });
    expect(close).not.toHaveBeenCalled();
  });
});
