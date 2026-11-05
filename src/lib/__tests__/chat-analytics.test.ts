/**
 * @jest-environment jsdom
 */
// CHAT-AGENT-P2-02: the voice-adoption events the P2-03 gate reads. No message text is sent;
// `chat_voice_unsupported` counts once per browser tab.
const mockTrack = jest.fn();
jest.mock("@vercel/analytics", () => ({ track: (...a: unknown[]) => mockTrack(...a) }));

beforeEach(() => {
  jest.resetModules();
  mockTrack.mockReset();
  sessionStorage.clear();
});

const load = () => require("../chat-analytics") as typeof import("../chat-analytics");

describe("chat-analytics", () => {
  it("a typed message is chat_message_sent only; a dictated one also chat_voice_input", () => {
    const { trackChatMessage } = load();
    trackChatMessage(false);
    trackChatMessage(true);
    expect(mockTrack.mock.calls).toEqual([
      ["chat_message_sent", { voice: false }],
      ["chat_message_sent", { voice: true }],
      ["chat_voice_input"],
    ]);
  });

  it("counts chat_voice_unsupported once per tab, across a reload", () => {
    load().trackVoiceUnsupported();
    load().trackVoiceUnsupported(); // same module: the in-memory flag
    jest.resetModules();
    load().trackVoiceUnsupported(); // a reload: sessionStorage remembers
    expect(mockTrack.mock.calls).toEqual([["chat_voice_unsupported"]]);
  });

  it("fires chat_voice_booking, and never throws when analytics does", () => {
    const { trackVoiceBooking, trackChatMessage } = load();
    trackVoiceBooking();
    expect(mockTrack).toHaveBeenCalledWith("chat_voice_booking");
    mockTrack.mockImplementation(() => { throw new Error("blocked"); });
    expect(() => trackChatMessage(true)).not.toThrow();
  });
});
