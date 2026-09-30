// REFACTOR-R4-P3-03: StripeClient.retrievePaymentForAudit — the mapping the booking-payment
// audit relies on. Refund and dispute state come from the expanded latest charge (the
// PaymentIntent's own status stays "succeeded" after a refund), and only Stripe's
// resource_missing reads as "no such payment": everything else must fail the run.
const mockRetrieve = jest.fn();
jest.mock("@/infrastructure/stripe/client-singleton", () => ({
  stripe: { paymentIntents: { retrieve: (...args: unknown[]) => mockRetrieve(...args) } },
}));

import { StripeClient } from "../StripeClient";

function stripeError(type: string, code?: string): Error {
  return Object.assign(new Error(`${type} ${code ?? ""}`), { type, code });
}

function intent(overrides: Record<string, unknown> = {}) {
  return {
    id:            "pi_1",
    status:        "succeeded",
    amount:        4900,
    latest_charge: { id: "ch_1", amount_refunded: 0, disputed: false },
    metadata:      { checkout_type: "single", session_duration: "1h", student_email: "ana@example.com" },
    ...overrides,
  };
}

describe("StripeClient.retrievePaymentForAudit", () => {
  const client = new StripeClient();

  beforeEach(() => mockRetrieve.mockReset());

  it("retrieves the PaymentIntent with its latest charge expanded", async () => {
    mockRetrieve.mockResolvedValue(intent());

    await client.retrievePaymentForAudit("pi_1");

    expect(mockRetrieve).toHaveBeenCalledWith("pi_1", { expand: ["latest_charge"] });
  });

  it("maps the status, the amounts, the dispute flag and the metadata", async () => {
    mockRetrieve.mockResolvedValue(intent({
      latest_charge: { id: "ch_1", amount_refunded: 1200, disputed: true },
    }));

    expect(await client.retrievePaymentForAudit("pi_1")).toEqual({
      status:          "succeeded",
      amount:          4900,
      amountRefunded:  1200,
      disputed:        true,
      checkoutType:    "single",
      sessionDuration: "1h",
      studentEmail:    "ana@example.com",
    });
  });

  it("no charge yet and no metadata: nothing refunded, nulls for the metadata", async () => {
    mockRetrieve.mockResolvedValue(intent({ status: "requires_payment_method", latest_charge: null, metadata: {} }));

    expect(await client.retrievePaymentForAudit("pi_1")).toEqual({
      status:          "requires_payment_method",
      amount:          4900,
      amountRefunded:  0,
      disputed:        false,
      checkoutType:    null,
      sessionDuration: null,
      studentEmail:    null,
    });
  });

  it("returns null when Stripe has no such PaymentIntent (resource_missing)", async () => {
    mockRetrieve.mockRejectedValue(stripeError("StripeInvalidRequestError", "resource_missing"));

    expect(await client.retrievePaymentForAudit("pi_gone")).toBeNull();
  });

  it.each([
    ["another invalid-request error", stripeError("StripeInvalidRequestError", "parameter_invalid_empty")],
    ["an API error",                  stripeError("StripeAPIError")],
    ["a connection error",            stripeError("StripeConnectionError")],
    ["a plain error",                 new Error("socket hang up")],
  ])("rethrows %s", async (_name, error) => {
    mockRetrieve.mockRejectedValue(error);

    await expect(client.retrievePaymentForAudit("pi_1")).rejects.toBe(error);
  });

  it("throws rather than read an unexpanded charge as 'never refunded'", async () => {
    mockRetrieve.mockResolvedValue(intent({ latest_charge: "ch_1" }));

    await expect(client.retrievePaymentForAudit("pi_1")).rejects.toThrow(/unexpanded/);
  });
});
