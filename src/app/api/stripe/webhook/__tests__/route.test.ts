// REFACTOR-P1-02: Route-level tests for Stripe webhook — verifies 500/200 semantics.
import { NextRequest } from "next/server";
import { PermanentWebhookError } from "@/domain/errors";

const mockProcessWebhookEvent = jest.fn();
const mockVerifyWebhookSignature = jest.fn();

jest.mock("@/services", () => ({
  paymentService: {
    verifyWebhookSignature: (...args: unknown[]) => mockVerifyWebhookSignature(...args),
    processWebhookEvent:    (...args: unknown[]) => mockProcessWebhookEvent(...args),
  },
}));

jest.mock("@/lib/logger", () => ({ log: jest.fn() }));

import { POST } from "../route";

const FAKE_EVENT = { id: "evt_test", type: "payment_intent.succeeded" };

function makeRequest(body = "{}") {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body,
    headers: {
      "stripe-signature": "t=123,v1=abc",
      "content-type": "application/json",
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  mockVerifyWebhookSignature.mockReturnValue(FAKE_EVENT);
});

describe("Stripe webhook route (REFACTOR-P1-02)", () => {
  it("returns 200 on successful processing", async () => {
    mockProcessWebhookEvent.mockResolvedValue(undefined);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true });
  });

  it("returns 500 on retryable failure (generic Error)", async () => {
    mockProcessWebhookEvent.mockRejectedValue(new Error("DB down"));

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Processing failed" });
  });

  it("returns 200 on PermanentWebhookError (Stripe should stop retrying)", async () => {
    mockProcessWebhookEvent.mockRejectedValue(
      new PermanentWebhookError("Missing student_email for pi_test"),
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true, permanentFailure: true });
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when signature verification fails", async () => {
    mockVerifyWebhookSignature.mockImplementation(() => {
      throw new Error("No signatures found");
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(400);
  });
});
