// SINGLE-SESSION-CONFIRM-01: GET /api/payment-confirmation/channel — single-session branch,
// ownership gate, mobile-bearer seam, and pack-branch regression.
//
// REFACTOR-R3-P3-03: the route is now a thin dispatcher — the Stripe call, the ownership
// gate and the single/pack branching live in PaymentService.getConfirmationChannelState
// (covered in PaymentService.test.ts). These tests cover what the route still owns:
// input validation, auth, the per-email limiter, error mapping, and verbatim pass-through
// of the service body (the mobile-facing wire contract).
import { NextRequest } from "next/server";

// Counting fake for the sliding-window limiter: 30 hits per key, then blocked.
const LIMIT = 30;
const hits = new Map<string, number>();
const mockLimit = jest.fn(async (key: string) => {
  const n = (hits.get(key) ?? 0) + 1;
  hits.set(key, n);
  return { success: n <= LIMIT };
});
jest.mock("@/lib/ratelimit", () => ({
  paymentChannelRatelimit: { limit: (key: string) => mockLimit(key) },
}));

const mockGetSession = jest.fn();
jest.mock("@/lib/session", () => ({ getSession: () => mockGetSession() }));

const mockGetConfirmationChannelState = jest.fn();
jest.mock("@/services", () => ({
  paymentService: {
    getConfirmationChannelState: (...args: unknown[]) => mockGetConfirmationChannelState(...args),
  },
}));

import { GET } from "@/app/api/payment-confirmation/channel/route";

const OWNER = "owner@test.com";

function makeReq(pi: string | null): NextRequest {
  const url = pi === null
    ? "http://localhost/api/payment-confirmation/channel"
    : `http://localhost/api/payment-confirmation/channel?payment_intent_id=${pi}`;
  return new NextRequest(url);
}

const detail = {
  eventId:     "evt_1",
  startIso:    "2099-12-01T10:00:00.000Z",
  endIso:      "2099-12-01T11:00:00.000Z",
  sessionType: "session1h",
  joinToken:   "j".repeat(64),
};

describe("SINGLE-SESSION-CONFIRM-01: GET /api/payment-confirmation/channel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hits.clear();
    mockGetSession.mockResolvedValue({ user: { email: OWNER } });
  });

  it("400s on a missing/invalid payment_intent_id", async () => {
    const res = await GET(makeReq("cs_not_a_pi"));
    expect(res.status).toBe(400);
    expect(mockGetConfirmationChannelState).not.toHaveBeenCalled();
  });

  it("401s when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET(makeReq("pi_single_1"));
    expect(res.status).toBe(401);
    expect(mockGetConfirmationChannelState).not.toHaveBeenCalled();
  });

  // 9. Ownership — non-owner gets 403 with no booking/status leakage.
  it("403s a non-owner and leaks no booking/status", async () => {
    mockGetConfirmationChannelState.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { statusCode: 403 }),
    );
    const res = await GET(makeReq("pi_single_1"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.booking).toBeUndefined();
    expect(body.status).toBeUndefined();
    expect(body.joinToken).toBeUndefined();
  });

  it("400s when the PaymentIntent metadata is incomplete", async () => {
    mockGetConfirmationChannelState.mockRejectedValue(
      Object.assign(new Error("PaymentIntent metadata incomplete"), { statusCode: 400 }),
    );
    const res = await GET(makeReq("pi_single_1"));
    expect(res.status).toBe(400);
  });

  it("500s when the Stripe retrieval fails", async () => {
    mockGetConfirmationChannelState.mockRejectedValue(new Error("stripe down"));
    const res = await GET(makeReq("pi_single_1"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not retrieve PaymentIntent" });
  });

  // 10. Mobile-bearer seam — getSession resolves the owner (cookie or bearer) identically.
  it("returns the single-session status for the verified owner", async () => {
    mockGetConfirmationChannelState.mockResolvedValue({
      channelName:  "pay:mac-pi_single_1",
      checkoutType: "single",
      status:       "confirmed",
      booking:      detail,
    });

    const res = await GET(makeReq("pi_single_1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      channelName:  "pay:mac-pi_single_1",
      checkoutType: "single",
      status:       "confirmed",
      booking:      detail,
    });
    expect(mockGetConfirmationChannelState).toHaveBeenCalledWith({
      paymentIntentId:    "pi_single_1",
      authenticatedEmail: OWNER,
    });
  });

  it("omits booking when the single-session status is non-confirmed", async () => {
    mockGetConfirmationChannelState.mockResolvedValue({
      channelName:  "pay:mac-pi_single_1",
      checkoutType: "single",
      status:       "slot_taken",
    });

    const body = await (await GET(makeReq("pi_single_1"))).json();
    expect(body).toEqual({
      channelName:  "pay:mac-pi_single_1",
      checkoutType: "single",
      status:       "slot_taken",
    });
    expect(body.booking).toBeUndefined();
  });

  // 11. Pack regression — unchanged shape (notably: no checkoutType key).
  it("returns the unchanged pack shape", async () => {
    mockGetConfirmationChannelState.mockResolvedValue({
      channelName: "pay:mac-pi_pack_1",
      confirmed:   true,
      credits:     5,
      name:        "S",
      packSize:    5,
    });

    const res = await GET(makeReq("pi_pack_1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      channelName: "pay:mac-pi_pack_1",
      confirmed:   true,
      credits:     5,
      name:        "S",
      packSize:    5,
    });
  });

  // REFACTOR-R3-P3-03: the limiter is keyed by the authenticated email, not the IP.
  describe("rate limiting", () => {
    beforeEach(() => {
      mockGetConfirmationChannelState.mockResolvedValue({
        channelName: "pay:mac-pi_pack_1", confirmed: false, credits: null, name: "S", packSize: 5,
      });
    });

    it("allows the first 30 requests from one account", async () => {
      for (let i = 1; i <= LIMIT; i++) {
        const res = await GET(makeReq("pi_pack_1"));
        expect(res.status).toBe(200);
      }
      expect(mockGetConfirmationChannelState).toHaveBeenCalledTimes(LIMIT);
    });

    it("429s the 31st request without touching the service", async () => {
      for (let i = 1; i <= LIMIT; i++) await GET(makeReq("pi_pack_1"));
      mockGetConfirmationChannelState.mockClear();

      const res = await GET(makeReq("pi_pack_1"));
      expect(res.status).toBe(429);
      expect(mockGetConfirmationChannelState).not.toHaveBeenCalled();
    });

    it("keys by authenticated email — a second account is unaffected", async () => {
      for (let i = 1; i <= LIMIT; i++) await GET(makeReq("pi_pack_1"));

      mockGetSession.mockResolvedValue({ user: { email: "other@test.com" } });
      const res = await GET(makeReq("pi_pack_1"));

      expect(res.status).toBe(200);
      expect(mockLimit).toHaveBeenLastCalledWith("other@test.com");
    });

    it("does not consume budget for unauthenticated requests", async () => {
      mockGetSession.mockResolvedValue(null);
      await GET(makeReq("pi_pack_1"));
      expect(mockLimit).not.toHaveBeenCalled();
    });
  });
});
