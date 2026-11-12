// REFACTOR-R4-P1-01: POST /api/stripe/checkout — the slot validator's DomainErrors
// reach the client as their 4xx code (so the UI can say why), while any other
// failure stays a logged 500. The validation itself is covered in PaymentService.test.ts.
import { NextRequest } from "next/server";
import { InvalidSlotError, SlotUnavailableError } from "@/domain/errors";

jest.mock("@/lib/ratelimit", () => ({
  checkoutRatelimit: { limit: jest.fn().mockResolvedValue({ success: true }) },
}));
jest.mock("@/lib/csrf", () => ({ isValidOrigin: () => true, isBearerOnlyRequest: () => false }));
jest.mock("@/lib/session", () => ({
  getSession: jest.fn().mockResolvedValue({ user: { email: "ana@test.com", name: "Ana" } }),
}));
const mockLog = jest.fn();
jest.mock("@/lib/logger", () => ({ log: (...args: unknown[]) => mockLog(...args) }));

const mockCreateSingleSessionCheckout = jest.fn();
jest.mock("@/services", () => ({
  paymentService: {
    createSingleSessionCheckout: (...args: unknown[]) => mockCreateSingleSessionCheckout(...args),
    createPackCheckout:          jest.fn(),
  },
}));

import { POST } from "@/app/api/stripe/checkout/route";

function makeReq(extra: Record<string, unknown> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/stripe/checkout", {
    method:  "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body:    JSON.stringify({
      type: "single", duration: "1h",
      startIso: "2026-10-05T13:30:00.000Z", endIso: "2026-10-05T16:30:00.000Z",
      ...extra,
    }),
  });
}

beforeEach(() => jest.clearAllMocks());

describe("REFACTOR-R4-P1-01: POST /api/stripe/checkout error mapping", () => {
  it.each([
    [new InvalidSlotError(),     400, "INVALID_SLOT"],
    [new SlotUnavailableError(), 409, "SLOT_UNAVAILABLE"],
  ])("maps %p to %i", async (err, status, code) => {
    mockCreateSingleSessionCheckout.mockRejectedValue(err);

    const res = await POST(makeReq());

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: code });
  });

  it("keeps a non-domain failure a logged 500", async () => {
    mockCreateSingleSessionCheckout.mockRejectedValue(new Error("stripe down"));

    const res = await POST(makeReq());

    expect(res.status).toBe(500);
    expect(mockLog).toHaveBeenCalledWith("error", "Stripe PaymentIntent creation error", expect.anything());
  });
});

// REFACTOR-R5-P1-04: a reschedule goes through /api/book, never through a paid checkout.
describe("REFACTOR-R5-P1-04: POST /api/stripe/checkout refuses a reschedule token", () => {
  it("answers 400 INVALID_REQUEST and creates no PaymentIntent", async () => {
    const res = await POST(makeReq({ rescheduleToken: "abc" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_REQUEST" });
    expect(mockCreateSingleSessionCheckout).not.toHaveBeenCalled();
  });

  it("the same body without the field still checks out, forwarding no token", async () => {
    mockCreateSingleSessionCheckout.mockResolvedValue({ clientSecret: "s", paymentIntentId: "pi_1" });

    const res = await POST(makeReq());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clientSecret: "s", paymentIntentId: "pi_1" });
    expect(mockCreateSingleSessionCheckout.mock.calls[0][0]).not.toHaveProperty("rescheduleToken");
  });
});
