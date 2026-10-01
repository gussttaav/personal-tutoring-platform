/**
 * @jest-environment jsdom
 */
// REFACTOR-R4-P2-04: the credit/session state is ONE per page. Every `useUserSession()` under a
// `UserSessionProvider` reads the same copy: one /api/credits per sign-in and per tab focus,
// and an `updateCredits` from one consumer (the pack overlay) is what the others (the Navbar
// badge) render. Outside the provider the hook throws instead of silently owning a copy.
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import type { CreditsResponse } from "@/domain/types";

let mockStatus: "authenticated" | "unauthenticated" | "loading" = "authenticated";
let mockSessionData: { user: { email: string; name: string } } | null = null;
jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: mockSessionData, status: mockStatus }),
}));

const mockCreditsGet = jest.fn<Promise<CreditsResponse>, []>();
jest.mock("@/lib/api-client", () => ({
  api: { credits: { get: () => mockCreditsGet() } },
}));

import UserSessionProvider from "@/components/UserSessionProvider";
import { useUserSession, type UserSessionValue } from "@/hooks/useUserSession";

const CREDITS: CreditsResponse = {
  credits: 5, name: "Ana", packSize: 5, hasBookings: true, expiresAt: "2027-03-01T00:00:00.000Z",
};

const seen: Record<string, UserSessionValue> = {};

function Consumer({ id }: { id: string }) {
  const value = useUserSession();
  useEffect(() => { seen[id] = value; });
  return <p data-testid={id}>{value.packSession ? `credits:${value.packSession.credits}` : "no-pack"}</p>;
}

function Page() {
  return (
    <UserSessionProvider>
      <Consumer id="navbar" />
      <Consumer id="overlay" />
    </UserSessionProvider>
  );
}

function signIn() {
  mockStatus = "authenticated";
  mockSessionData = { user: { email: "ana@example.com", name: "Ana" } };
}

function fireVisible() {
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
}

beforeAll(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
});

beforeEach(() => {
  mockCreditsGet.mockReset().mockResolvedValue(CREDITS);
  signIn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("REFACTOR-R4-P2-04: one user-session state per page", () => {
  it("fetches /api/credits once for every consumer under the provider", async () => {
    render(<Page />);

    await waitFor(() => expect(screen.getByTestId("navbar").textContent).toBe("credits:5"));
    expect(screen.getByTestId("overlay").textContent).toBe("credits:5");
    expect(mockCreditsGet).toHaveBeenCalledTimes(1);
    expect(seen.navbar).toBe(seen.overlay);
  });

  it("shares updateCredits: one consumer's update is what the other renders", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByTestId("navbar").textContent).toBe("credits:5"));

    act(() => { seen.overlay.updateCredits(3); });
    expect(screen.getByTestId("navbar").textContent).toBe("credits:3");
    expect(seen.navbar.packSession?.credits).toBe(3);

    act(() => { seen.overlay.updateCredits(0); });
    expect(screen.getByTestId("navbar").textContent).toBe("no-pack");
    expect(screen.getByTestId("overlay").textContent).toBe("no-pack");
  });

  it("keeps updateCredits / clearPackSession stable and the value memoized across re-renders", async () => {
    const { rerender } = render(<Page />);
    await waitFor(() => expect(screen.getByTestId("navbar").textContent).toBe("credits:5"));
    const before = seen.navbar;

    rerender(<Page />);
    expect(seen.navbar).toBe(before);

    act(() => { before.updateCredits(4); });
    expect(seen.navbar).not.toBe(before);
    expect(seen.navbar.updateCredits).toBe(before.updateCredits);
    expect(seen.navbar.clearPackSession).toBe(before.clearPackSession);
  });

  it("refetches once per tab focus, not once per consumer, and honours the 30 s cooldown", async () => {
    render(<Page />);
    await waitFor(() => expect(mockCreditsGet).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("navbar").textContent).toBe("credits:5"));

    const t0 = Date.now();
    const now = jest.spyOn(Date, "now").mockReturnValue(t0);
    fireVisible();
    await waitFor(() => expect(mockCreditsGet).toHaveBeenCalledTimes(2));

    now.mockReturnValue(t0 + 10_000);
    fireVisible();
    expect(mockCreditsGet).toHaveBeenCalledTimes(2);

    now.mockReturnValue(t0 + 31_000);
    fireVisible();
    await waitFor(() => expect(mockCreditsGet).toHaveBeenCalledTimes(3));
  });

  it("clears every consumer's pack state together on sign-out", async () => {
    const { rerender } = render(<Page />);
    await waitFor(() => expect(screen.getByTestId("navbar").textContent).toBe("credits:5"));

    mockStatus = "unauthenticated";
    mockSessionData = null;
    rerender(<Page />);

    expect(screen.getByTestId("navbar").textContent).toBe("no-pack");
    expect(screen.getByTestId("overlay").textContent).toBe("no-pack");
    expect(seen.navbar.isSignedIn).toBe(false);
    expect(seen.overlay.hasBookings).toBeNull();
  });

  it("makes no request for a signed-out visitor", () => {
    mockStatus = "unauthenticated";
    mockSessionData = null;
    render(<Page />);

    expect(mockCreditsGet).not.toHaveBeenCalled();
    expect(screen.getByTestId("navbar").textContent).toBe("no-pack");
  });

  it("throws a clear error outside the provider", () => {
    // renderHook prints React's error noise for an expected throw.
    jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useUserSession())).toThrow(
      "useUserSession() must be used inside <UserSessionProvider>",
    );
  });
});
