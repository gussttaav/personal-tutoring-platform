/**
 * @jest-environment jsdom
 */
// CHAT-AGENT-P1-04 — the chat renders the `actions` /api/chat returns. Pinned: each message
// sends the visitor's timezone (a supported one only); a `slots` reply becomes chips whose pick
// is sent as the next message; actions persist with the message; only the LATEST proposal in
// the thread is live; a booking from a card is persisted on its message.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("next-intl", () => ({
  useTranslations: (ns: string) => {
    const t = (key: string, params?: Record<string, string>) =>
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
jest.mock("@/hooks/useUserSession", () => ({
  useUserSession: () => ({ isSignedIn: true, isAuthLoading: false }),
}));
jest.mock("@/components/booking/ScheduleProvider", () => ({ useScheduleConfigOptional: () => null }));
const mockBookPost = jest.fn();
jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, api: { book: { post: (...args: unknown[]) => mockBookPost(...args) } } };
});
jest.mock("@/lib/booking-analytics", () => ({ trackBooking: jest.fn() }));

import Chat from "@/components/Chat";

const NOW = Date.parse("2026-11-03T08:00:00Z");
const slot = (iso: string) => ({ startIso: iso, endIso: new Date(Date.parse(iso) + 900_000).toISOString() });
const proposal = (iso: string) => ({ type: "proposal", sessionType: "free15min", ...slot(iso) });

/** jsdom has no `Response`; Chat only reads `ok` and `json()`. */
function mockChatReply(body: unknown) {
  const calls: Record<string, unknown>[] = [];
  global.fetch = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as typeof fetch;
  return calls;
}

function seedThread(messages: unknown[]) {
  sessionStorage.setItem("chat:messages", JSON.stringify(messages));
}

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  jest.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
    .mockReturnValue({ timeZone: "America/Bogota" } as Intl.ResolvedDateTimeFormatOptions);
  sessionStorage.clear();
  localStorage.clear();
  mockBookPost.mockReset();
});

afterEach(() => jest.restoreAllMocks());

function send(text: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "chat.send" }));
}

describe("CHAT-AGENT-P1-04: Chat actions", () => {
  it("sends the visitor's timezone, renders slot chips in the reply's timezone, and a pick is the next message", async () => {
    const calls = mockChatReply({
      reply: "Tengo estos huecos", sessionId: null, timezone: "America/Bogota",
      actions: [{ type: "slots", durationMinutes: 15, slots: [slot("2026-11-04T15:00:00.000Z")] }],
    });
    render(<Chat />);

    send("¿tienes hueco mañana?");

    // 15:00Z is 10:00 in Bogotá.
    const chip = await screen.findByRole("button", { name: "mié 4 · 10:00" });
    expect(calls[0]).toMatchObject({ message: "¿tienes hueco mañana?", timezone: "America/Bogota" });

    fireEvent.click(chip);
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].message).toBe('chat.actions.pickSlot{"day":"mié 4 nov","time":"10:00"}');
  });

  it("sends no timezone when the browser's isn't supported (the tools use the tutor's)", async () => {
    (Intl.DateTimeFormat.prototype.resolvedOptions as jest.Mock)
      .mockReturnValue({ timeZone: "Asia/Tokyo" } as Intl.ResolvedDateTimeFormatOptions);
    const calls = mockChatReply({ reply: "Hola", sessionId: null, actions: [] });
    render(<Chat />);

    send("hola");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).not.toHaveProperty("timezone");
  });

  it("persists actions with the message", async () => {
    mockChatReply({
      reply: "¿Te va bien?", sessionId: null, timezone: "Europe/Madrid",
      actions: [proposal("2026-11-04T09:00:00.000Z")],
    });
    render(<Chat />);

    send("el miércoles a las 10");

    await screen.findByRole("button", { name: "chat.actions.confirm" });
    const saved = JSON.parse(sessionStorage.getItem("chat:messages")!);
    expect(saved.at(-1)).toMatchObject({
      role: "bot", timezone: "Europe/Madrid", actions: [proposal("2026-11-04T09:00:00.000Z")],
    });
  });

  it("only the latest proposal in the thread is live", () => {
    seedThread([
      { role: "bot", text: "hola" },
      { role: "bot", text: "¿El martes?", timezone: "Europe/Madrid", actions: [proposal("2026-11-04T09:00:00.000Z")] },
      { role: "user", text: "mejor el jueves" },
      { role: "bot", text: "¿El jueves?", timezone: "Europe/Madrid", actions: [proposal("2026-11-05T09:00:00.000Z")] },
    ]);
    render(<Chat />);

    const cards = screen.getAllByRole("group", { name: /proposalLabel/ });
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain("chat.actions.superseded");
    expect(cards[0].querySelector("button")).toBeNull();
    expect(cards[1].textContent).toContain("chat.actions.confirm");
  });

  it("a booking from the card is persisted on its message", async () => {
    mockBookPost.mockResolvedValue({ emailFailed: false });
    seedThread([
      { role: "bot", text: "hola" },
      { role: "user", text: "el miércoles a las 10" },
      { role: "bot", text: "¿Te va bien?", timezone: "Europe/Madrid", actions: [proposal("2026-11-04T09:00:00.000Z")] },
    ]);
    render(<Chat />);

    fireEvent.click(screen.getByRole("button", { name: "chat.actions.confirm" }));

    await screen.findByText("chat.actions.booked");
    const saved = JSON.parse(sessionStorage.getItem("chat:messages")!);
    expect(saved[2].booking).toEqual({ emailFailed: false });
  });
});
