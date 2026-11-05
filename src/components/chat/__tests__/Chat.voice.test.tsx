/**
 * @jest-environment jsdom
 */
// CHAT-AGENT-P2-02 — read-aloud in the chat, with a fake SpeechRecognition and a fake
// speechSynthesis. Pinned: a dictated turn is sent with `voice: true`, primes the engine inside
// the tap and has its reply spoken as speakable text; a typed one is neither; the header toggle
// silences it and survives a remount; a reply landing after the panel closed is not spoken;
// the adoption events fire (message, voice input, unsupported, voice booking).
// CHAT-AGENT-P2-01b: while listening the mic is a stop square with a hint; on a touch device the
// user's stop sends the message as a voice turn, on a desktop it lands in the input, and a
// dictation the browser ended by itself never sends.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("next-intl", () => ({
  useTranslations: (ns: string) => {
    const t = (key: string) => `${ns}.${key}`;
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
const mockChatState = { isOpen: true, close: jest.fn() };
jest.mock("@/hooks/useChat", () => ({ useChat: () => mockChatState }));
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
const mockTrackMessage     = jest.fn();
const mockTrackUnsupported = jest.fn();
const mockTrackVoiceBooking = jest.fn();
jest.mock("@/lib/chat-analytics", () => ({
  trackChatMessage:      (...a: unknown[]) => mockTrackMessage(...a),
  trackVoiceUnsupported: () => mockTrackUnsupported(),
  trackVoiceBooking:     () => mockTrackVoiceBooking(),
}));

import Chat from "@/components/Chat";

// ─── Fakes ────────────────────────────────────────────────────────────────────

class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = ""; interimResults = false; continuous = true; maxAlternatives = 0;
  onresult: ((e: unknown) => void) | null = null;
  onerror:  ((e: unknown) => void) | null = null;
  onend:    (() => void) | null = null;
  constructor() { FakeRecognition.last = this; }
  start() {}
  stop()  {}
  abort() { this.onend?.(); }
  hear(text: string) {
    this.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal: true })] });
  }
  say(text: string) {
    this.hear(text);
    this.onend?.();
  }
}

class FakeUtterance {
  lang = "";
  voice: unknown = null;
  constructor(public text: string) {}
}

const synth = {
  spoken: [] as FakeUtterance[],
  cancel: jest.fn(),
  speak: jest.fn((u: FakeUtterance) => { synth.spoken.push(u); }),
  getVoices: () => [],
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

type SpeechWindow = { webkitSpeechRecognition?: unknown; speechSynthesis?: unknown; SpeechSynthesisUtterance?: unknown };

function mockChatReply(body: unknown) {
  const calls: Record<string, unknown>[] = [];
  let release: () => void = () => {};
  const gate = { hold: false };
  global.fetch = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    if (gate.hold) await new Promise<void>((r) => { release = r; });
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as typeof fetch;
  return { calls, gate, release: () => release() };
}

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  jest.clearAllMocks();
  synth.spoken = [];
  mockChatState.isOpen = true;
  const w = window as unknown as SpeechWindow;
  w.webkitSpeechRecognition = FakeRecognition;
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  w.SpeechSynthesisUtterance = FakeUtterance;
  (globalThis as SpeechWindow).SpeechSynthesisUtterance = FakeUtterance;
});

afterEach(() => {
  const w = window as unknown as SpeechWindow;
  delete w.webkitSpeechRecognition;
  delete w.speechSynthesis;
  delete w.SpeechSynthesisUtterance;
});

function dictate(text: string) {
  fireEvent.click(screen.getByRole("button", { name: "chat.voice.start" }));
  act(() => FakeRecognition.last!.say(text));
}

function clickSend() {
  fireEvent.click(screen.getByRole("button", { name: "chat.send" }));
}

const spokenTexts = () => synth.spoken.map((u) => u.text);

let touchMode = false;
beforeEach(() => {
  touchMode = false;
  window.matchMedia = ((query: string) => ({
    matches: query === "(pointer: coarse)" && touchMode,
    addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CHAT-AGENT-P2-02: read-aloud", () => {
  it("sends a dictated turn with voice: true, primes inside the tap and speaks the reply as plain text", async () => {
    const { calls } = mockChatReply({ reply: "**Claro.** Mira [Mentoría](https://x.dev/mentoria).", sessionId: null, actions: [] });
    render(<Chat />);

    dictate("¿tienes hueco mañana?");
    clickSend();
    // The prime: an empty utterance, before the reply arrives.
    expect(spokenTexts()).toEqual([""]);

    await waitFor(() => expect(spokenTexts()).toHaveLength(2));
    expect(calls[0]).toMatchObject({ message: "¿tienes hueco mañana?", voice: true });
    expect(synth.spoken[1]).toMatchObject({ text: "Claro. Mira Mentoría.", lang: "es-ES" });
    expect(mockTrackMessage).toHaveBeenCalledWith(true);
    const saved = JSON.parse(sessionStorage.getItem("chat:messages")!);
    expect(saved.find((m: { role: string }) => m.role === "user")).toMatchObject({ voice: true });
  });

  it("neither flags nor speaks a typed turn", async () => {
    const { calls } = mockChatReply({ reply: "Hola", sessionId: null, actions: [] });
    render(<Chat />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hola" } });
    clickSend();

    await screen.findByText("Hola");
    expect(calls[0]).not.toHaveProperty("voice");
    expect(synth.speak).not.toHaveBeenCalled();
    expect(mockTrackMessage).toHaveBeenCalledWith(false);
  });

  it("the toggle silences read-aloud, sends no voice flag, and survives a remount", async () => {
    const { calls } = mockChatReply({ reply: "Vale", sessionId: null, actions: [] });
    const { unmount } = render(<Chat />);

    fireEvent.click(screen.getByRole("button", { name: "chat.voice.readAloudOn" }));
    expect(localStorage.getItem("chat:readAloud")).toBe("off");
    dictate("hola");
    clickSend();

    await screen.findByText("Vale");
    expect(calls[0]).not.toHaveProperty("voice");
    expect(synth.speak).not.toHaveBeenCalled();
    expect(mockTrackMessage).toHaveBeenCalledWith(true); // still a dictated message

    unmount();
    render(<Chat />);
    fireEvent.click(screen.getByRole("button", { name: "chat.voice.readAloudOff" }));
    expect(localStorage.getItem("chat:readAloud")).toBeNull();
  });

  it("doesn't speak a reply that lands after the panel closed", async () => {
    const reply = mockChatReply({ reply: "Tarde", sessionId: null, actions: [] });
    reply.gate.hold = true;
    const { rerender } = render(<Chat />);

    dictate("hola");
    clickSend();
    await waitFor(() => expect(reply.calls).toHaveLength(1));
    mockChatState.isOpen = false;
    rerender(<Chat />);
    act(() => reply.release());

    await screen.findByText("Tarde");
    expect(spokenTexts()).toEqual([""]); // the prime only
  });

  it("starting to dictate stops the reply being read", () => {
    render(<Chat />);
    synth.cancel.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "chat.voice.start" }));
    expect(synth.cancel).toHaveBeenCalled();
  });

  it("counts a booking from the card as a voice booking when the conversation used voice", async () => {
    mockBookPost.mockResolvedValue({ emailFailed: false });
    const proposal = { type: "proposal", sessionType: "free15min", startIso: "2099-11-04T09:00:00.000Z", endIso: "2099-11-04T09:15:00.000Z" };
    sessionStorage.setItem("chat:messages", JSON.stringify([
      { role: "bot", text: "hola" },
      { role: "user", text: "el miércoles a las 10", voice: true },
      { role: "bot", text: "¿Te va bien?", timezone: "Europe/Madrid", actions: [proposal] },
    ]));
    render(<Chat />);

    fireEvent.click(screen.getByRole("button", { name: "chat.actions.confirm" }));

    await screen.findByText("chat.actions.booked");
    expect(mockTrackVoiceBooking).toHaveBeenCalledTimes(1);
  });

  it("doesn't count a typed conversation's booking as a voice one", async () => {
    mockBookPost.mockResolvedValue({ emailFailed: false });
    const proposal = { type: "proposal", sessionType: "free15min", startIso: "2099-11-04T09:00:00.000Z", endIso: "2099-11-04T09:15:00.000Z" };
    sessionStorage.setItem("chat:messages", JSON.stringify([
      { role: "bot", text: "hola" },
      { role: "user", text: "el miércoles a las 10" },
      { role: "bot", text: "¿Te va bien?", timezone: "Europe/Madrid", actions: [proposal] },
    ]));
    render(<Chat />);

    fireEvent.click(screen.getByRole("button", { name: "chat.actions.confirm" }));

    await screen.findByText("chat.actions.booked");
    expect(mockTrackVoiceBooking).not.toHaveBeenCalled();
  });

  it("without the recognition API: no mic, no toggle, and the unsupported event", () => {
    delete (window as unknown as SpeechWindow).webkitSpeechRecognition;
    render(<Chat />);

    expect(screen.queryByRole("button", { name: "chat.voice.start" })).toBeNull();
    expect(screen.queryByRole("button", { name: /chat\.voice\.readAloud/ })).toBeNull();
    expect(mockTrackUnsupported).toHaveBeenCalled();
  });

  describe("CHAT-AGENT-P2-01b: continuous dictation", () => {
    function listenAndHear(text: string) {
      fireEvent.click(screen.getByRole("button", { name: "chat.voice.start" }));
      act(() => FakeRecognition.last!.hear(text));
    }

    it("on a touch device the stop tap sends the dictated text as a voice turn", async () => {
      touchMode = true;
      const { calls } = mockChatReply({ reply: "Te ayudo", sessionId: null, actions: [] });
      render(<Chat />);

      listenAndHear("Estoy en primero de ingeniería y me cuesta el cálculo");
      expect(screen.getByText("chat.voice.listeningHintSend")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "chat.voice.stopAndSend" }));
      expect(spokenTexts()).toEqual([""]); // primed inside the stop tap
      act(() => FakeRecognition.last!.onend?.());

      await screen.findByText("Te ayudo");
      expect(calls[0]).toMatchObject({ message: "Estoy en primero de ingeniería y me cuesta el cálculo", voice: true });
      expect(mockTrackMessage).toHaveBeenCalledWith(true);
    });

    it("on a desktop the stop tap leaves the text in the input to review", () => {
      const { calls } = mockChatReply({ reply: "x", sessionId: null, actions: [] });
      render(<Chat />);

      listenAndHear("hola, quería preguntar");
      expect(screen.getByText("chat.voice.listeningHintReview")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "chat.voice.stop" }));
      act(() => FakeRecognition.last!.onend?.());

      expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("hola, quería preguntar");
      expect(calls).toHaveLength(0);
    });

    it("on a touch device a dictation the browser ended by itself is not sent", () => {
      touchMode = true;
      const { calls } = mockChatReply({ reply: "x", sessionId: null, actions: [] });
      render(<Chat />);

      dictate("me quedé callado");

      expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("me quedé callado");
      expect(calls).toHaveLength(0);
    });

    it("the composer is a textarea: Shift+Enter keeps a line break, Enter sends it", async () => {
      const { calls } = mockChatReply({ reply: "ok", sessionId: null, actions: [] });
      render(<Chat />);
      const box = screen.getByRole("textbox");
      expect(box.tagName).toBe("TEXTAREA");

      fireEvent.change(box, { target: { value: "Hola.\nTengo una duda" } });
      fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
      expect(calls).toHaveLength(0);
      fireEvent.keyDown(box, { key: "Enter" });

      await screen.findByText("ok");
      expect(calls[0].message).toBe("Hola.\nTengo una duda");
    });

    it("the touch send keeps what was typed before dictating", async () => {
      touchMode = true;
      const { calls } = mockChatReply({ reply: "ok", sessionId: null, actions: [] });
      render(<Chat />);

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hola." } });
      listenAndHear("Necesito ayuda con Python");
      fireEvent.click(screen.getByRole("button", { name: "chat.voice.stopAndSend" }));
      act(() => FakeRecognition.last!.onend?.());

      await screen.findByText("ok");
      expect(calls[0].message).toBe("Hola. Necesito ayuda con Python");
    });
  });
});
