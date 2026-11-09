/**
 * @jest-environment jsdom
 */
// CHAT-AGENT-P3-02 — the browser half of «Comparar con mi calendario», against a fake GIS
// token client and a fake fetch. Pinned: the token request asks only for calendar.freebusy
// with prompt "" (the grant is kept, no consent screen on a later comparison); a closed popup
// or a declined consent is `dismissed` (silent), a Workspace policy is `blocked`; freeBusy is
// called on www.googleapis.com with the bearer token and only the chips' range.

process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";

const lib = require("@/lib/google-calendar-freebusy") as typeof import("@/lib/google-calendar-freebusy");

type Config = Record<string, unknown> & {
  callback:       (r: Record<string, unknown>) => void;
  error_callback: (e: { type?: string }) => void;
};

let configs: Config[];
let respond: (config: Config) => void;
const hasGrantedAllScopes = jest.fn(() => true);

beforeEach(() => {
  configs = [];
  respond = (c) => c.callback({ access_token: "tok", expires_in: 3599 });
  hasGrantedAllScopes.mockReturnValue(true);
  (window as unknown as { google: unknown }).google = {
    accounts: {
      oauth2: {
        initTokenClient: (config: Config) => {
          configs.push(config);
          return { requestAccessToken: () => respond(config) };
        },
        hasGrantedAllScopes,
      },
    },
  };
});

describe("requestFreeBusyToken", () => {
  it("asks only for calendar.freebusy, with the login hint and prompt \"\"", async () => {
    const before = Date.now();
    const token = await lib.requestFreeBusyToken("ana@example.com");
    expect(configs[0]).toMatchObject({
      client_id:  "test-client.apps.googleusercontent.com",
      scope:      "https://www.googleapis.com/auth/calendar.freebusy",
      login_hint: "ana@example.com",
      prompt:     "",
    });
    expect(token.accessToken).toBe("tok");
    expect(token.expiresAt).toBeGreaterThanOrEqual(before + 3_599_000);
  });

  it("a closed popup is dismissed", async () => {
    respond = (c) => c.error_callback({ type: "popup_closed" });
    await expect(lib.requestFreeBusyToken()).rejects.toMatchObject({ kind: "dismissed" });
  });

  it("a declined consent (access_denied) is dismissed, not «your organisation»", async () => {
    respond = (c) => c.callback({ error: "access_denied" });
    await expect(lib.requestFreeBusyToken()).rejects.toMatchObject({ kind: "dismissed" });
  });

  it("a scope left unticked is dismissed", async () => {
    hasGrantedAllScopes.mockReturnValue(false);
    await expect(lib.requestFreeBusyToken()).rejects.toMatchObject({ kind: "dismissed" });
  });

  it("a Workspace policy is blocked", async () => {
    respond = (c) => c.callback({ error: "admin_policy_enforced" });
    await expect(lib.requestFreeBusyToken()).rejects.toMatchObject({ kind: "blocked" });
  });

  it("a popup that can't open fails", async () => {
    respond = (c) => c.error_callback({ type: "popup_failed_to_open" });
    await expect(lib.requestFreeBusyToken()).rejects.toMatchObject({ kind: "failed" });
  });
});

describe("isTokenFresh", () => {
  it("is false for no token and for one expiring within a minute", () => {
    const now = 1_000_000;
    expect(lib.isTokenFresh(null, now)).toBe(false);
    expect(lib.isTokenFresh({ accessToken: "t", expiresAt: now + 30_000 }, now)).toBe(false);
    expect(lib.isTokenFresh({ accessToken: "t", expiresAt: now + 30 * 60_000 }, now)).toBe(true);
  });
});

describe("fetchBusy", () => {
  function mockFetch(status: number, body: unknown) {
    const fetchMock = jest.fn(async () => ({ ok: status < 400, status, json: async () => body }) as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it("POSTs the range for the primary calendar to googleapis with the bearer token", async () => {
    const busy = [{ start: "2026-11-10T10:00:00Z", end: "2026-11-10T11:00:00Z" }];
    const fetchMock = mockFetch(200, { calendars: { primary: { busy } } });

    await expect(lib.fetchBusy("tok", "2026-11-10T08:00:00.000Z", "2026-11-12T18:00:00.000Z")).resolves.toEqual(busy);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://www.googleapis.com/calendar/v3/freeBusy");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(String(init.body))).toEqual({
      timeMin: "2026-11-10T08:00:00.000Z",
      timeMax: "2026-11-12T18:00:00.000Z",
      items:   [{ id: "primary" }],
    });
  });

  it("an empty calendar is no busy intervals", async () => {
    mockFetch(200, { calendars: { primary: { busy: [] } } });
    await expect(lib.fetchBusy("tok", "a", "b")).resolves.toEqual([]);
  });

  it("an HTTP error, a calendar error or a network error fails", async () => {
    mockFetch(401, {});
    await expect(lib.fetchBusy("tok", "a", "b")).rejects.toMatchObject({ kind: "failed" });
    mockFetch(200, { calendars: { primary: { errors: [{ reason: "notFound" }] } } });
    await expect(lib.fetchBusy("tok", "a", "b")).rejects.toMatchObject({ kind: "failed" });
    global.fetch = jest.fn(async () => { throw new TypeError("offline"); }) as unknown as typeof fetch;
    await expect(lib.fetchBusy("tok", "a", "b")).rejects.toMatchObject({ kind: "failed" });
  });
});
