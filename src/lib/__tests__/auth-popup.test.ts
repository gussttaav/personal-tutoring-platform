import { signInWithPopup } from "@/lib/auth-popup";

// Fake popup returned by window.open
function makeFakePopup(initialClosed = false) {
  return { closed: initialClosed, close: jest.fn() };
}

const ORIGIN = "https://gustavoai.dev";

describe("signInWithPopup", () => {
  let messageListeners: ((e: MessageEvent) => void)[];
  let mockOpen: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    messageListeners = [];
    mockOpen = jest.fn();

    // Expose browser globals in the Node.js Jest environment
    Object.defineProperty(global, "window", {
      writable: true,
      configurable: true,
      value: {
        open: mockOpen,
        location: { origin: ORIGIN },
        screenX: 0,
        screenY: 0,
        outerWidth: 1024,
        outerHeight: 768,
        addEventListener: jest.fn((type: string, handler: (e: MessageEvent) => void) => {
          if (type === "message") messageListeners.push(handler);
        }),
        removeEventListener: jest.fn(),
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns blocked:true immediately when window.open returns null", async () => {
    mockOpen.mockReturnValue(null);
    const result = await signInWithPopup("/booking");
    expect(result).toEqual({ success: false, blocked: true });
  });

  it("resolves success:true when AUTH_COMPLETE message arrives from same origin", async () => {
    const popup = makeFakePopup();
    mockOpen.mockReturnValue(popup);

    const promise = signInWithPopup("/booking");

    const event = new MessageEvent("message", {
      data: { type: "AUTH_COMPLETE" },
      origin: ORIGIN,
    });
    messageListeners.forEach((l) => l(event));

    const result = await promise;
    expect(result).toEqual({ success: true, blocked: false });
    expect(popup.close).toHaveBeenCalled();
  });

  it("resolves success:false blocked:false when user closes popup without auth", async () => {
    const popup = makeFakePopup();
    mockOpen.mockReturnValue(popup);

    const promise = signInWithPopup("/");

    popup.closed = true;
    jest.advanceTimersByTime(600); // past the 500 ms poll interval

    const result = await promise;
    expect(result).toEqual({ success: false, blocked: false });
  });

  it("ignores messages from a different origin", async () => {
    const popup = makeFakePopup();
    mockOpen.mockReturnValue(popup);

    const promise = signInWithPopup("/");

    const foreignEvent = new MessageEvent("message", {
      data: { type: "AUTH_COMPLETE" },
      origin: "https://evil.com",
    });
    messageListeners.forEach((l) => l(foreignEvent));

    // Promise must not have settled — close popup to resolve it
    popup.closed = true;
    jest.advanceTimersByTime(600);

    const result = await promise;
    expect(result).toEqual({ success: false, blocked: false });
  });

  it("ignores messages with an unknown type from same origin", async () => {
    const popup = makeFakePopup();
    mockOpen.mockReturnValue(popup);

    const promise = signInWithPopup("/");

    const otherEvent = new MessageEvent("message", {
      data: { type: "SOME_OTHER_EVENT" },
      origin: ORIGIN,
    });
    messageListeners.forEach((l) => l(otherEvent));

    popup.closed = true;
    jest.advanceTimersByTime(600);

    const result = await promise;
    expect(result).toEqual({ success: false, blocked: false });
  });

  it("encodes callbackUrl into the sign-in URL passed to window.open", () => {
    mockOpen.mockReturnValue(makeFakePopup());
    signInWithPopup("/?intent=session1h&slotStart=2026-05-01T10%3A00%3A00.000Z");

    const openedUrl = mockOpen.mock.calls[0][0] as string;
    // The outer signInUrl encodes the whole popupCallbackUrl once,
    // and popupCallbackUrl already encodes the original callbackUrl once,
    // so the intent ends up double-encoded in the raw URL string.
    const fullyDecoded = decodeURIComponent(decodeURIComponent(openedUrl));
    expect(openedUrl).toContain("/auth/signin-popup");
    expect(fullyDecoded).toContain("/auth/popup-callback");
    expect(fullyDecoded).toContain("/?intent=session1h");
  });

  it("does not settle twice when AUTH_COMPLETE arrives after popup already closed", async () => {
    const popup = makeFakePopup();
    mockOpen.mockReturnValue(popup);
    const resolveSpy = jest.fn();

    const promise = signInWithPopup("/").then((r) => {
      resolveSpy(r);
      return r;
    });

    // First: close popup
    popup.closed = true;
    jest.advanceTimersByTime(600);
    await promise;
    expect(resolveSpy).toHaveBeenCalledTimes(1);

    // Late AUTH_COMPLETE — must be ignored
    const event = new MessageEvent("message", {
      data: { type: "AUTH_COMPLETE" },
      origin: ORIGIN,
    });
    messageListeners.forEach((l) => l(event));

    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });
});
