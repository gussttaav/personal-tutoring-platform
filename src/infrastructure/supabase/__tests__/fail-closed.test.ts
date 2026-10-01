// REFACTOR-R4-P1-02: the reads whose "absent" answer authorizes a side effect (process /
// refund / erase) must REJECT on a PostgREST error, and still answer false / null / []
// when the row is genuinely absent.
//
// Unit test, not DB-gated: the Supabase client is mocked with a chainable builder whose
// every call returns itself and which resolves to `mockResult` when awaited — the same
// shape PostgREST gives back ({ data, count, error }), whatever the terminal call.

let mockResult: { data: unknown; count: number | null; error: unknown } = {
  data: null, count: null, error: null,
};

jest.mock("../client", () => {
  const builder: unknown = new Proxy({}, {
    get: (_target, prop) =>
      prop === "then"
        ? (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
            Promise.resolve(mockResult).then(resolve, reject)
        : () => builder,
  });
  return { supabase: { from: () => builder } };
});

// Keep the suite hermetic: realtime-channel throws at import without its secret.
jest.mock("@/lib/realtime-channel", () => ({
  paymentChannelName: (id: string) => `pay:${id}`,
}));

import { SupabasePaymentRepository } from "../SupabasePaymentRepository";
import { SupabaseBookingRepository } from "../SupabaseBookingRepository";
import { SupabaseCreditsRepository } from "../SupabaseCreditsRepository";

const DB_ERROR = { code: "PGRST000", message: "boom" };
const EMAIL    = "student@example.com";
const PI       = "pi_test_123";

const payments = new SupabasePaymentRepository();
const bookings = new SupabaseBookingRepository();
const credits  = new SupabaseCreditsRepository();

// [label, read, the answer it gives when the row is genuinely absent]
const reads: [string, () => Promise<unknown>, unknown][] = [
  ["payments.isProcessed",            () => payments.isProcessed(PI),            false],
  ["payments.hasFailedBooking",       () => payments.hasFailedBooking(PI),       false],
  ["payments.wasRefunded",            () => payments.wasRefunded(PI),            false],
  ["bookings.findByStripePaymentId",  () => bookings.findByStripePaymentId(PI),  null],
  ["bookings.hasBookingForPayment",   () => bookings.hasBookingForPayment(PI),   false],
  ["bookings.listByUser",             () => bookings.listByUser(EMAIL),          []],
  ["bookings.hasAnyBooking",          () => bookings.hasAnyBooking(EMAIL),       false],
  ["credits.hasProcessedPayment",     () => credits.hasProcessedPayment(PI),     false],
  // findUserId is private; these three are the public reads that go through it.
  ["credits.getCredits",              () => credits.getCredits(EMAIL),           null],
  ["credits.decrementCredit",         () => credits.decrementCredit(EMAIL),
    { ok: false, remaining: 0, packSize: null, packId: null }],
  ["credits.restoreCredit",           () => credits.restoreCredit(EMAIL),        { ok: false, credits: 0 }],
];

describe("REFACTOR-R4-P1-02: Supabase reads fail closed", () => {
  it.each(reads)("%s rejects on a read error", async (_label, read) => {
    mockResult = { data: null, count: null, error: DB_ERROR };
    await expect(read()).rejects.toMatchObject(DB_ERROR);
  });

  it.each(reads)("%s still answers 'absent' when there is no row", async (_label, read, absent) => {
    mockResult = { data: null, count: 0, error: null };
    await expect(read()).resolves.toEqual(absent);
  });

  // .maybeSingle() errors on two rows; the count doesn't. A rescheduled paid class
  // leaves an old cancelled row and a new confirmed one sharing the PaymentIntent.
  it("hasBookingForPayment is true for two rows sharing a PaymentIntent", async () => {
    mockResult = { data: null, count: 2, error: null };
    await expect(bookings.hasBookingForPayment(PI)).resolves.toBe(true);
  });
});
