/**
 * @jest-environment jsdom
 */
// CHAT-AGENT-P1-04 — the chat's free-call confirmation card. Its Confirmar is the one booking
// write (`api.book.post`, as the wizard). Pinned: signed out it offers the Google sign-in and
// never books on its own; a double tap sends one request; a booked / superseded / expired card
// can't book; errors map to the slot-taken retry, the free-call rule, or the generic message.
// Copy is rendered as its message key, so the assertions name keys.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

let mockSession = { isSignedIn: true, isAuthLoading: false };
let mockMinNoticeHours: number | null = null;

jest.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => "es",
}));
jest.mock("next/navigation", () => ({ usePathname: () => "/blog/un-post" }));
jest.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    require("react").createElement("a", { href, ...rest }, children),
}));
jest.mock("@/components/GoogleSignInButton", () => ({
  __esModule: true,
  default: ({ label, resumeInPlace, callbackUrl }: { label: string; resumeInPlace: boolean; callbackUrl: string }) =>
    require("react").createElement("button", {
      "data-testid": "google-signin", "data-resume": String(resumeInPlace), "data-callback": callbackUrl,
    }, label),
}));
jest.mock("@/hooks/useUserSession", () => ({ useUserSession: () => mockSession }));
jest.mock("@/components/booking/ScheduleProvider", () => ({
  useScheduleConfigOptional: () => (mockMinNoticeHours === null ? null : { minNoticeHours: mockMinNoticeHours }),
}));
const mockBookPost = jest.fn();
jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, api: { book: { post: (...args: unknown[]) => mockBookPost(...args) } } };
});
const mockTrackBooking = jest.fn();
jest.mock("@/lib/booking-analytics", () => ({ trackBooking: (...a: unknown[]) => mockTrackBooking(...a) }));

import FreeCallProposalCard from "../FreeCallProposalCard";
import { ApiError } from "@/lib/api-client";

const NOW      = Date.parse("2026-11-03T08:00:00Z");
const START    = "2026-11-04T09:00:00.000Z"; // Wednesday 10:00 in Madrid
const END      = "2026-11-04T09:15:00.000Z";

const confirmButton = () => screen.queryByRole("button", { name: "chat.actions.confirm" });

function renderCard(props: Partial<React.ComponentProps<typeof FreeCallProposalCard>> = {}) {
  const handlers = { onBooked: jest.fn(), onFindAnother: jest.fn() };
  const utils = render(
    <FreeCallProposalCard
      startIso={START} endIso={END} timezone="Europe/Madrid"
      live booked={null} chatBusy={false} {...handlers} {...props}
    />,
  );
  return { ...utils, ...handlers };
}

beforeEach(() => {
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  mockSession = { isSignedIn: true, isAuthLoading: false };
  mockMinNoticeHours = null;
  mockBookPost.mockReset();
  mockTrackBooking.mockReset();
});

afterEach(() => jest.restoreAllMocks());

describe("CHAT-AGENT-P1-04: FreeCallProposalCard", () => {
  it("shows the slot in the reply's timezone, as a labelled group", () => {
    renderCard();

    const card = screen.getByRole("group");
    expect(card.getAttribute("aria-label")).toBe("chat.actions.proposalLabel");
    expect(card.textContent).toContain("miércoles, 4 de noviembre · 10:00–10:15");
    expect(card.textContent).toContain("chat.actions.proposalTitle");
    expect(card.textContent).toContain("chat.actions.timezone");
  });

  it("signed out: offers the in-place Google sign-in, and Confirmar only after the session flips", () => {
    mockSession = { isSignedIn: false, isAuthLoading: false };
    const { rerender } = renderCard();

    const signIn = screen.getByTestId("google-signin");
    expect(signIn.getAttribute("data-resume")).toBe("true");
    expect(signIn.getAttribute("data-callback")).toBe("/blog/un-post");
    expect(confirmButton()).toBeNull();

    mockSession = { isSignedIn: true, isAuthLoading: false };
    rerender(
      <FreeCallProposalCard
        startIso={START} endIso={END} timezone="Europe/Madrid"
        live booked={null} chatBusy={false} onBooked={jest.fn()} onFindAnother={jest.fn()}
      />,
    );

    expect(screen.queryByTestId("google-signin")).toBeNull();
    expect(confirmButton()).not.toBeNull();
    expect(mockBookPost).not.toHaveBeenCalled(); // no booking after sign-in without a tap (Q1)
  });

  it("books the free call through api.book.post, once for a double tap", async () => {
    let resolve!: (v: unknown) => void;
    mockBookPost.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { onBooked } = renderCard();

    fireEvent.click(confirmButton()!);
    fireEvent.click(screen.getByRole("button", { name: "chat.actions.booking" }));

    expect(mockBookPost).toHaveBeenCalledTimes(1);
    expect(mockBookPost).toHaveBeenCalledWith({
      startIso: START, endIso: END, sessionType: "free15min", timezone: expect.any(String),
    });

    await act(async () => resolve({ emailFailed: false, cancelToken: "tok" }));

    expect(onBooked).toHaveBeenCalledWith({ emailFailed: false });
    expect(mockTrackBooking).toHaveBeenCalledWith("free15min");
  });

  it("a booked card shows the result and the personal-area link, never Confirmar", () => {
    const { rerender } = renderCard({ booked: { emailFailed: false } });

    expect(screen.getByText("chat.actions.booked")).not.toBeNull();
    expect(screen.getByRole("link", { name: "chat.actions.goToPersonalArea" }).getAttribute("href"))
      .toBe("/area-personal");
    expect(confirmButton()).toBeNull();

    rerender(
      <FreeCallProposalCard
        startIso={START} endIso={END} timezone="Europe/Madrid" live={false}
        booked={{ emailFailed: true }} chatBusy={false} onBooked={jest.fn()} onFindAnother={jest.fn()}
      />,
    );
    expect(screen.getByText("chat.actions.bookedNoEmail")).not.toBeNull();
  });

  it("only the latest proposal is live: an older card renders disabled", () => {
    renderCard({ live: false });

    expect(screen.getByText("chat.actions.superseded")).not.toBeNull();
    expect(confirmButton()).toBeNull();
    expect(screen.queryByTestId("google-signin")).toBeNull();
  });

  it("a slot already past renders expired", () => {
    renderCard({ startIso: "2026-11-02T09:00:00.000Z", endIso: "2026-11-02T09:15:00.000Z" });

    expect(screen.getByText("chat.actions.expired")).not.toBeNull();
    expect(confirmButton()).toBeNull();
  });

  it("a slot inside the booking min-notice renders expired", () => {
    mockMinNoticeHours = 48; // START is 25 h away
    renderCard();

    expect(screen.getByText("chat.actions.expired")).not.toBeNull();
    expect(confirmButton()).toBeNull();
  });

  it("re-checks the time on tap: a card left open past its slot expires instead of booking", () => {
    renderCard();
    (Date.now as jest.Mock).mockReturnValue(Date.parse(START) + 60_000);

    fireEvent.click(confirmButton()!);

    expect(mockBookPost).not.toHaveBeenCalled();
    expect(screen.getByText("chat.actions.expired")).not.toBeNull();
  });

  it("SLOT_UNAVAILABLE: «that slot was just taken» and a «find another» message", async () => {
    mockBookPost.mockRejectedValue(new ApiError("SLOT_UNAVAILABLE", 409, "SLOT_UNAVAILABLE"));
    const { onFindAnother } = renderCard();

    fireEvent.click(confirmButton()!);

    await waitFor(() => expect(screen.getByText("chat.actions.slotTaken")).not.toBeNull());
    expect(confirmButton()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "chat.actions.findAnother" }));
    expect(onFindAnother).toHaveBeenCalledWith("chat.actions.findAnotherMessage");
  });

  it("FREE_SESSION_ALREADY_USED: states the rule, with nothing to retry", async () => {
    mockBookPost.mockRejectedValue(
      new ApiError("FREE_SESSION_ALREADY_USED", 409, "FREE_SESSION_ALREADY_USED"),
    );
    renderCard();

    fireEvent.click(confirmButton()!);

    await waitFor(() =>
      expect(screen.getByText("errors.domain.freeSessionAlreadyUsed")).not.toBeNull());
    expect(confirmButton()).toBeNull();
    expect(screen.queryByRole("button", { name: "chat.actions.findAnother" })).toBeNull();
  });

  it("any other error: the mapped message, and Confirmar can be tapped again", async () => {
    mockBookPost.mockRejectedValueOnce(new ApiError("", 500, ""));
    mockBookPost.mockResolvedValueOnce({ emailFailed: false });
    const { onBooked } = renderCard();

    fireEvent.click(confirmButton()!);
    await waitFor(() => expect(screen.getByText("errors.http.500")).not.toBeNull());

    fireEvent.click(confirmButton()!);
    await waitFor(() => expect(onBooked).toHaveBeenCalledWith({ emailFailed: false }));
    expect(mockBookPost).toHaveBeenCalledTimes(2);
  });
});
