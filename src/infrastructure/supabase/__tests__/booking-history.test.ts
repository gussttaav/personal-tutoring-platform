// BOOKING-HISTORY-01: unit tests for the pure history helpers. No database —
// these cover the two things most likely to be got wrong: the keyset cursor and
// the "what did this class cost" derivation.
import { buildCursor, deriveAmount, parseCursor, type PaymentInfo } from "../booking-history";
import { InvalidCursorError } from "@/domain/errors";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("parseCursor", () => {
  it("round-trips a cursor built by buildCursor", () => {
    const cursor = buildCursor("2026-06-14T17:00:00.000Z", UUID_A);
    expect(parseCursor(cursor)).toEqual({ startsAt: "2026-06-14T17:00:00.000Z", id: UUID_A });
  });

  it("normalizes a Postgres-style timestamp to the JS ISO form", () => {
    // PostgREST returns "+00:00" and may drop trailing zeros; JS uses "Z".
    // Comparing the two forms as strings would silently mis-page.
    expect(parseCursor(`2026-06-14T17:00:00.13+00:00_${UUID_A}`).startsAt)
      .toBe("2026-06-14T17:00:00.130Z");
  });

  it.each([
    ["no separator",       `2026-06-14T17:00:00.000Z${UUID_A}`],
    ["empty timestamp",    `_${UUID_A}`],
    ["non-uuid id",        "2026-06-14T17:00:00.000Z_not-a-uuid"],
    ["unparseable date",   `banana_${UUID_A}`],
    ["empty string",       ""],
  ])("rejects a malformed cursor (%s)", (_label, cursor) => {
    // Rejected, not ignored: silently falling back to page one would make a
    // paging client loop forever instead of surfacing the bug.
    expect(() => parseCursor(cursor)).toThrow(InvalidCursorError);
  });
});

describe("deriveAmount", () => {
  const payments: Map<string, PaymentInfo> = new Map([
    ["pi_single", { amountCents: 7500, currency: "eur" }],
    ["pi_pack",   { amountCents: 30000, currency: "eur" }],
  ]);

  it("returns null for a free class — it was never charged", () => {
    expect(deriveAmount("free15min", undefined, null, payments))
      .toEqual({ amountCents: null, currency: null });
  });

  it("reads the booking's own charge for a single session", () => {
    expect(deriveAmount("session1h", undefined, "pi_single", payments))
      .toEqual({ amountCents: 7500, currency: "eur" });
  });

  it("divides the pack's charge across its credits for a pack class", () => {
    // €300 pack of 10 → €30 per class.
    expect(deriveAmount("pack", { packSize: 10, stripePaymentId: "pi_pack" }, null, payments))
      .toEqual({ amountCents: 3000, currency: "eur" });
  });

  it("rounds a pack price that does not divide evenly", () => {
    const odd: Map<string, PaymentInfo> = new Map([["pi_odd", { amountCents: 9999, currency: "eur" }]]);
    expect(deriveAmount("pack", { packSize: 5, stripePaymentId: "pi_odd" }, null, odd))
      .toEqual({ amountCents: 2000, currency: "eur" });
  });

  it("returns null when the payment row is missing rather than throwing", () => {
    // Legacy bookings predate the payments table; a missing receipt must not
    // break the whole history list.
    expect(deriveAmount("session2h", undefined, "pi_vanished", payments))
      .toEqual({ amountCents: null, currency: null });
    expect(deriveAmount("pack", { packSize: 5, stripePaymentId: "pi_vanished" }, null, payments))
      .toEqual({ amountCents: null, currency: null });
  });

  it("returns null for a single session with no payment id", () => {
    expect(deriveAmount("session1h", undefined, null, payments))
      .toEqual({ amountCents: null, currency: null });
  });

  it("never divides by zero on a malformed pack", () => {
    expect(deriveAmount("pack", { packSize: 0, stripePaymentId: "pi_pack" }, null, payments))
      .toEqual({ amountCents: null, currency: null });
  });

  it("ignores the pricing table by construction — the same class costs what was paid", () => {
    // Two identical session1h bookings paid at different times/prices keep their
    // own amounts. This is the regression that reading `pricing` would introduce.
    const historical: Map<string, PaymentInfo> = new Map([
      ["pi_old", { amountCents: 5000, currency: "eur" }],
      ["pi_new", { amountCents: 7500, currency: "eur" }],
    ]);
    expect(deriveAmount("session1h", undefined, "pi_old", historical).amountCents).toBe(5000);
    expect(deriveAmount("session1h", undefined, "pi_new", historical).amountCents).toBe(7500);
  });
});

describe("buildCursor", () => {
  it("normalizes the timestamp so the cursor is stable across DB/JS formats", () => {
    expect(buildCursor("2026-06-14T17:00:00.13+00:00", UUID_B))
      .toBe(`2026-06-14T17:00:00.130Z_${UUID_B}`);
  });
});
