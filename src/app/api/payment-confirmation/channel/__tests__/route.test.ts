// SINGLE-SESSION-CONFIRM-01: GET /api/payment-confirmation/channel — single-session branch,
// ownership gate, mobile-bearer seam, and pack-branch regression.
import { NextRequest } from "next/server";

const mockRetrieve = jest.fn();
jest.mock("stripe", () =>
  jest.fn().mockImplementation(() => ({
    paymentIntents: { retrieve: (...args: unknown[]) => mockRetrieve(...args) },
  })),
);

const mockGetSession = jest.fn();
jest.mock("@/lib/session", () => ({ getSession: () => mockGetSession() }));

const mockGetSingleSessionStatus = jest.fn();
const mockHasProcessedPayment    = jest.fn();
const mockGetBalance             = jest.fn();
jest.mock("@/services", () => ({
  paymentService: {
    getSingleSessionStatus: (...args: unknown[]) => mockGetSingleSessionStatus(...args),
  },
  creditService: {
    hasProcessedPayment: (...args: unknown[]) => mockHasProcessedPayment(...args),
    getBalance:          (...args: unknown[]) => mockGetBalance(...args),
  },
}));

// Avoid REALTIME_CHANNEL_SECRET env requirement; assert the route forwards the channel name.
jest.mock("@/lib/realtime-channel", () => ({
  paymentChannelName: (id: string) => `pay:mac-${id}`,
}));

import { GET } from "@/app/api/payment-confirmation/channel/route";

const OWNER = "owner@test.com";

function makeReq(pi: string | null): NextRequest {
  const url = pi === null
    ? "http://localhost/api/payment-confirmation/channel"
    : `http://localhost/api/payment-confirmation/channel?payment_intent_id=${pi}`;
  return new NextRequest(url);
}

function singlePI(email = OWNER) {
  return { id: "pi_single_1", metadata: { checkout_type: "single", student_email: email, student_name: "S" } };
}

function packPI(email = OWNER) {
  return { id: "pi_pack_1", metadata: { checkout_type: "pack", student_email: email, student_name: "S", pack_size: "5" } };
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
    process.env.STRIPE_SECRET_KEY = "sk_test";
    mockGetSession.mockResolvedValue({ user: { email: OWNER } });
  });

  it("400s on a missing/invalid payment_intent_id", async () => {
    const res = await GET(makeReq("cs_not_a_pi"));
    expect(res.status).toBe(400);
  });

  it("401s when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET(makeReq("pi_single_1"));
    expect(res.status).toBe(401);
  });

  // 9. Ownership — non-owner gets 403 with no booking/status leakage.
  it("403s a non-owner and leaks no booking/status", async () => {
    mockRetrieve.mockResolvedValue(singlePI("someone-else@test.com"));
    const res = await GET(makeReq("pi_single_1"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.booking).toBeUndefined();
    expect(body.status).toBeUndefined();
    expect(body.joinToken).toBeUndefined();
    expect(mockGetSingleSessionStatus).not.toHaveBeenCalled();
  });

  // 10. Mobile-bearer seam — getSession resolves the owner (cookie or bearer) identically.
  it("returns the single-session status for the verified owner", async () => {
    mockRetrieve.mockResolvedValue(singlePI());
    mockGetSingleSessionStatus.mockResolvedValue({ status: "confirmed", booking: detail });

    const res = await GET(makeReq("pi_single_1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      channelName:  "pay:mac-pi_single_1",
      checkoutType: "single",
      status:       "confirmed",
      booking:      detail,
    });
    expect(mockGetSingleSessionStatus).toHaveBeenCalledWith("pi_single_1");
  });

  it("omits booking when the single-session status is non-confirmed", async () => {
    mockRetrieve.mockResolvedValue(singlePI());
    mockGetSingleSessionStatus.mockResolvedValue({ status: "slot_taken" });

    const body = await (await GET(makeReq("pi_single_1"))).json();
    expect(body).toEqual({
      channelName:  "pay:mac-pi_single_1",
      checkoutType: "single",
      status:       "slot_taken",
    });
    expect(body.booking).toBeUndefined();
  });

  // 11. Pack regression — unchanged shape, single branch never touched.
  it("returns the unchanged pack shape and does not enter the single branch", async () => {
    mockRetrieve.mockResolvedValue(packPI());
    mockHasProcessedPayment.mockResolvedValue(true);
    mockGetBalance.mockResolvedValue({ credits: 5, name: "S", packSize: 5 });

    const res = await GET(makeReq("pi_pack_1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      channelName: "pay:mac-pi_pack_1",
      confirmed:   true,
      credits:     5,
      name:        "S",
      packSize:    5,
    });
    expect(mockGetSingleSessionStatus).not.toHaveBeenCalled();
  });
});
