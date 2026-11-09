/**
 * @jest-environment jsdom
 */
// CHAT-AGENT-P3-02 — «Comparar con mi calendario» under the slot chips. The Google side
// (token popup, freeBusy) is faked; the overlap filter is the real one. Pinned: only a
// signed-in visitor sees the button; a busy hour hides the chips inside it; closing the popup
// or declining leaves the chips with no message; a Workspace block and an API error each say
// so; the token is reused for a second comparison in the conversation and dropped on «Nueva
// conversación»; nothing about the calendar goes to /api/chat.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";

jest.mock("next-intl", () => ({
  useTranslations: (ns: string) => {
    const t = (key: string, params?: Record<string, unknown>) =>
      params ? `${ns}.${key}${JSON.stringify(params)}` : `${ns}.${key}`;
    t.raw = () => [];
    return t;
  },
  useLocale: () => "es",
}));
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => require("react").createElement("p", null, children),
}));
jest.mock("remark-gfm", () => ({ __esModule: true, default: () => undefined }));
jest.mock("@/hooks/useChat", () => ({ useChat: () => ({ isOpen: true, close: jest.fn() }) }));
jest.mock("next/navigation", () => ({ usePathname: () => "/" }));
jest.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) =>
    require("react").createElement("a", { href }, children),
}));
jest.mock("@/components/GoogleSignInButton", () => ({ __esModule: true, default: () => null }));
let mockSignedIn = true;
jest.mock("@/hooks/useUserSession", () => ({
  useUserSession: () => ({
    isSignedIn: mockSignedIn, isAuthLoading: false,
    googleUser: mockSignedIn ? { email: "ana@example.com" } : null,
  }),
}));
jest.mock("@/components/booking/ScheduleProvider", () => ({ useScheduleConfigOptional: () => null }));
jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, api: { book: { post: jest.fn() } } };
});
jest.mock("@/lib/booking-analytics", () => ({ trackBooking: jest.fn() }));
jest.mock("@/lib/chat-analytics", () => ({
  trackChatMessage: jest.fn(), trackVoiceUnsupported: jest.fn(), trackVoiceBooking: jest.fn(),
}));

const mockRequestToken = jest.fn();
const mockFetchBusy    = jest.fn();
let mockClientId = "client-id";
jest.mock("@/lib/google-calendar-freebusy", () => {
  const actual = jest.requireActual("@/lib/google-calendar-freebusy");
  return {
    ...actual,
    get GOOGLE_CLIENT_ID() { return mockClientId; },
    loadGis:              jest.fn(() => Promise.resolve({})),
    requestFreeBusyToken: (...args: unknown[]) => mockRequestToken(...args),
    fetchBusy:            (...args: unknown[]) => mockFetchBusy(...args),
  };
});

import Chat from "@/components/Chat";
import SlotChips from "@/components/chat/SlotChips";
import { FreeBusyError, type FreeBusyToken } from "@/lib/google-calendar-freebusy";

const NOW = Date.parse("2026-11-09T08:00:00Z");
const slot = (iso: string) => ({ startIso: iso, endIso: new Date(Date.parse(iso) + 900_000).toISOString() });
/** Tuesday 10 Nov 2026, 09:30 → 11:15 Madrid (UTC+1), every 15 minutes. */
const ROW = ["08:30", "08:45", "09:00", "09:15", "09:30", "09:45", "10:00", "10:15"]
  .map((hhmm) => slot(`2026-11-10T${hhmm}:00.000Z`));
/** «10:00–11:00» Madrid. */
const MEETING = [{ start: "2026-11-10T10:00:00+01:00", end: "2026-11-10T11:00:00+01:00" }];

const chipTimes = () =>
  screen.queryAllByRole("button").map((b) => b.textContent ?? "").filter((x) => / · /.test(x)).map((x) => x.split(" · ")[1]);

function renderChips(token = createRef<FreeBusyToken | null>() as { current: FreeBusyToken | null }) {
  render(
    <SlotChips
      slots={ROW} timezone="Europe/Madrid" nowMs={NOW} disabled={false} onPick={jest.fn()}
      calendarTokenRef={token}
    />,
  );
  return token;
}

const compareButton = () => screen.queryByRole("button", { name: /chat\.calendar\.(compare|comparing)/ });

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  mockSignedIn = true;
  mockClientId = "client-id";
  mockRequestToken.mockReset().mockResolvedValue({ accessToken: "tok", expiresAt: Date.now() + 3_600_000 });
  mockFetchBusy.mockReset().mockResolvedValue(MEETING);
  sessionStorage.clear();
  localStorage.clear();
});

describe("CHAT-AGENT-P3-02: SlotChips calendar comparison", () => {
  it("hides the 10:00, 10:15, 10:30 and 10:45 chips for a 10:00–11:00 meeting, and keeps the rest", async () => {
    renderChips();
    expect(chipTimes()).toEqual(["09:30", "09:45", "10:00", "10:15", "10:30", "10:45", "11:00", "11:15"]);

    fireEvent.click(compareButton()!);

    await screen.findByText('chat.calendar.filtered{"count":4}');
    expect(chipTimes()).toEqual(["09:30", "09:45", "11:00", "11:15"]);
    expect(screen.getByRole("group", { name: "chat.calendar.filteredLabel" })).toBeTruthy();
    expect(compareButton()).toBeNull();
    // the visitor's email as login hint; the chips' whole range, nothing more
    expect(mockRequestToken).toHaveBeenCalledWith("ana@example.com");
    expect(mockFetchBusy).toHaveBeenCalledWith("tok", "2026-11-10T08:30:00.000Z", "2026-11-10T10:30:00.000Z");
  });

  it("says when none fits", async () => {
    mockFetchBusy.mockResolvedValue([{ start: "2026-11-10T00:00:00+01:00", end: "2026-11-11T00:00:00+01:00" }]);
    renderChips();
    fireEvent.click(compareButton()!);
    await screen.findByText("chat.calendar.none");
    expect(chipTimes()).toEqual([]);
  });

  it("signed-out visitors don't see the button", () => {
    mockSignedIn = false;
    renderChips();
    expect(compareButton()).toBeNull();
    expect(chipTimes()).toHaveLength(8);
  });

  it("no button without a Google client id", () => {
    mockClientId = "";
    renderChips();
    expect(compareButton()).toBeNull();
  });

  it("a closed popup or declined consent leaves the chips, the button and no message", async () => {
    mockRequestToken.mockRejectedValue(new FreeBusyError("dismissed", "popup_closed"));
    renderChips();
    fireEvent.click(compareButton()!);

    await waitFor(() => expect(compareButton()?.textContent).toContain("chat.calendar.compare"));
    expect(chipTimes()).toHaveLength(8);
    expect(screen.queryByRole("status")).toBeNull();
    expect(mockFetchBusy).not.toHaveBeenCalled();
  });

  it("a Workspace block says the organisation doesn't allow it", async () => {
    mockRequestToken.mockRejectedValue(new FreeBusyError("blocked", "admin_policy_enforced"));
    renderChips();
    fireEvent.click(compareButton()!);
    await screen.findByText("chat.calendar.blocked");
    expect(chipTimes()).toHaveLength(8);
    expect(compareButton()).toBeNull();
  });

  it("a Google API error says so, keeps the chips and drops the token so a retry asks again", async () => {
    mockFetchBusy.mockRejectedValueOnce(new FreeBusyError("failed", "freeBusy 401"));
    const token = renderChips();
    fireEvent.click(compareButton()!);

    await screen.findByText("chat.calendar.failed");
    expect(chipTimes()).toHaveLength(8);
    expect(token.current).toBeNull();

    fireEvent.click(compareButton()!);
    await screen.findByText('chat.calendar.filtered{"count":4}');
    expect(mockRequestToken).toHaveBeenCalledTimes(2);
  });

  it("reuses a fresh token without opening the popup", async () => {
    const token = { current: { accessToken: "kept", expiresAt: Date.now() + 30 * 60_000 } };
    renderChips(token);
    fireEvent.click(compareButton()!);
    await screen.findByText('chat.calendar.filtered{"count":4}');
    expect(mockRequestToken).not.toHaveBeenCalled();
    expect(mockFetchBusy.mock.calls[0][0]).toBe("kept");
  });

  it("asks again for a token about to expire", async () => {
    const token = { current: { accessToken: "old", expiresAt: Date.now() + 10_000 } };
    renderChips(token);
    fireEvent.click(compareButton()!);
    await screen.findByText('chat.calendar.filtered{"count":4}');
    expect(mockRequestToken).toHaveBeenCalledTimes(1);
    expect(token.current?.accessToken).toBe("tok");
  });
});

describe("CHAT-AGENT-P3-02: the token in the conversation", () => {
  const seedTwoRows = () =>
    sessionStorage.setItem("chat:messages", JSON.stringify([
      { role: "bot", text: "hola" },
      { role: "bot", text: "Huecos", timezone: "Europe/Madrid",
        actions: [{ type: "slots", durationMinutes: 15, slots: ROW.slice(0, 4) }] },
      { role: "user", text: "¿y por la tarde?" },
      { role: "bot", text: "Más huecos", timezone: "Europe/Madrid",
        actions: [{ type: "slots", durationMinutes: 15, slots: ROW.slice(4) }] },
    ]));

  it("one popup for two comparisons; the token never reaches /api/chat; «Nueva conversación» drops it", async () => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    mockRequestToken.mockResolvedValue({ accessToken: "tok", expiresAt: NOW + 3_600_000 });
    seedTwoRows();
    const chatCalls: Record<string, unknown>[] = [];
    global.fetch = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      chatCalls.push(JSON.parse(String(init?.body)));
      return { ok: true, status: 200, json: async () => ({
        reply: "Otros", sessionId: null, timezone: "Europe/Madrid",
        actions: [{ type: "slots", durationMinutes: 15, slots: ROW.slice(0, 2) }],
      }) } as Response;
    }) as typeof fetch;
    render(<Chat />);

    const buttons = () => screen.getAllByRole("button", { name: "chat.calendar.compare" });
    expect(buttons()).toHaveLength(2);
    fireEvent.click(buttons()[0]);
    await screen.findByText('chat.calendar.filtered{"count":2}'); // 09:30, 09:45
    fireEvent.click(buttons()[0]);                                  // the second row's
    await waitFor(() => expect(screen.getAllByText('chat.calendar.filtered{"count":2}')).toHaveLength(2)); // 11:00, 11:15
    expect(mockRequestToken).toHaveBeenCalledTimes(1);

    // a pick sends the usual text, nothing about the calendar
    fireEvent.click(screen.getByRole("button", { name: "mar 10 · 09:30" }));
    await waitFor(() => expect(chatCalls).toHaveLength(1));
    expect(JSON.stringify(chatCalls[0])).not.toMatch(/tok|busy|calendar/i);
    await screen.findByText("Otros"); // the reply landed, the chat is idle again

    // «Nueva conversación», then a fresh reply with chips: the popup opens again
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "chat.newConversation" })); });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "huecos" } });
    fireEvent.click(screen.getByRole("button", { name: "chat.send" }));
    fireEvent.click(await screen.findByRole("button", { name: "chat.calendar.compare" }));
    await screen.findByText(/chat\.calendar\.filtered/);
    expect(mockRequestToken).toHaveBeenCalledTimes(2);
    expect(chatCalls).toHaveLength(2);
    expect(chatCalls[1]).toMatchObject({ message: "huecos" });
  });
});
