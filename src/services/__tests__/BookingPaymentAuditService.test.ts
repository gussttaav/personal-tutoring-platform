// REFACTOR-R4-P3-03 — BookingPaymentAuditService: the daily read-only audit of upcoming
// bookings against their payments.
//
// evaluateBooking is pure, so the rule matrix is table-driven over hand-built bookings and
// payment facts. The orchestration (the read, the horizon, one Stripe call per distinct
// PaymentIntent, fail closed) runs over InMemoryBookingRepository + FakeStripeClient +
// FakeEmailClient.
import {
  AUDIT_STRIPE_CONCURRENCY,
  BookingPaymentAuditService,
  evaluateBooking,
} from "../BookingPaymentAuditService";
import type {
  PaymentAuditBooking, PaymentAuditCode, PaymentAuditSeverity, SessionType,
} from "@/domain/types";
import type { PaymentAuditFacts } from "@/infrastructure/stripe/StripeClient";
import { BOOKING_WINDOW_WEEKS, SESSION_DURATION_MINUTES } from "@/lib/booking-config";
import { InMemoryBookingRepository } from "@/__tests__/fixtures/InMemoryBookingRepository";
import { FakeStripeClient } from "@/__tests__/fixtures/FakeStripeClient";
import { FakeEmailClient } from "@/__tests__/fixtures/FakeEmailClient";

const EMAIL = "ana@example.com";
const START = "2026-10-05T08:00:00.000Z";
const at    = (minutes: number) => new Date(Date.parse(START) + minutes * 60_000).toISOString();

// ─── evaluateBooking ─────────────────────────────────────────────────────────

function paid(overrides: Partial<PaymentAuditBooking> = {}): PaymentAuditBooking {
  return {
    bookingId:       "b-1",
    email:           EMAIL,
    sessionType:     "session1h",
    startsAt:        START,
    endsAt:          at(60),
    stripePaymentId: "pi_single",
    creditPack:      null,
    ...overrides,
  };
}

const paid2h = (overrides: Partial<PaymentAuditBooking> = {}) =>
  paid({ sessionType: "session2h", endsAt: at(120), ...overrides });

const free = (overrides: Partial<PaymentAuditBooking> = {}) =>
  paid({ sessionType: "free15min", endsAt: at(15), stripePaymentId: null, ...overrides });

function packClass(
  overrides: Partial<PaymentAuditBooking> = {},
  pack: Partial<NonNullable<PaymentAuditBooking["creditPack"]>> = {},
): PaymentAuditBooking {
  return paid({
    sessionType:     "pack",
    stripePaymentId: null,
    creditPack:      { id: "pack-1", ownedByBookingUser: true, stripePaymentId: "pi_pack", ...pack },
    ...overrides,
  });
}

function facts(overrides: Partial<PaymentAuditFacts> = {}): PaymentAuditFacts {
  return {
    status:          "succeeded",
    amount:          4900,
    amountRefunded:  0,
    disputed:        false,
    checkoutType:    "single",
    sessionDuration: "1h",
    studentEmail:    EMAIL,
    ...overrides,
  };
}

const facts2h   = (overrides: Partial<PaymentAuditFacts> = {}) =>
  facts({ sessionDuration: "2h", amount: 9000, ...overrides });
const packFacts = (overrides: Partial<PaymentAuditFacts> = {}) =>
  facts({ checkoutType: "pack", sessionDuration: null, amount: 22500, ...overrides });

const codes = (b: PaymentAuditBooking, f?: PaymentAuditFacts | null) =>
  evaluateBooking(b, f).map(x => [x.code, x.severity] as [PaymentAuditCode, PaymentAuditSeverity]);

describe("evaluateBooking — clean bookings produce no finding", () => {
  it.each<[string, PaymentAuditBooking, PaymentAuditFacts | null | undefined]>([
    ["a 15-minute free call",                         free(),     undefined],
    ["a paid 1h class",                               paid(),     facts()],
    ["a paid 2h class",                               paid2h(),   facts2h()],
    ["a pack class",                                  packClass(), packFacts()],
    ["a pack class on a manual (admin-granted) pack", packClass({}, { stripePaymentId: "manual-3f1c9a2e" }), undefined],
    ["a payment email differing only in case and whitespace",
      paid(), facts({ studentEmail: "  Ana@Example.COM " })],
  ])("%s", (_name, booking, f) => {
    expect(evaluateBooking(booking, f)).toEqual([]);
  });
});

describe("evaluateBooking — every rule produces its code", () => {
  it.each<[string, PaymentAuditBooking, PaymentAuditFacts | null | undefined, [PaymentAuditCode, PaymentAuditSeverity][]]>([
    // length_mismatch — every type, free calls included
    ["a free call longer than 15 minutes",     free({ endsAt: at(60) }),       undefined,   [["length_mismatch", "error"]]],
    ["a 1h class booked for 2 hours",          paid({ endsAt: at(120) }),      facts(),     [["length_mismatch", "error"]]],
    ["a 2h class booked for 1 hour",           paid2h({ endsAt: at(60) }),     facts2h(),   [["length_mismatch", "error"]]],
    ["a pack class booked for 2 hours",        packClass({ endsAt: at(120) }), packFacts(), [["length_mismatch", "error"]]],
    ["an unparseable end",                     paid({ endsAt: "not-a-date" }), facts(),     [["length_mismatch", "error"]]],
    // no_payment_link / pack_not_owned
    ["a 1h class with no PaymentIntent",       paid({ stripePaymentId: null }),   undefined, [["no_payment_link", "error"]]],
    ["a 2h class with no PaymentIntent",       paid2h({ stripePaymentId: null }), undefined, [["no_payment_link", "error"]]],
    ["a pack class with no pack",              packClass({ creditPack: null }),   undefined, [["no_payment_link", "error"]]],
    ["a pack class on another student's pack", packClass({}, { ownedByBookingUser: false }), undefined, [["pack_not_owned", "error"]]],
    ["a manual pack owned by someone else",    packClass({}, { ownedByBookingUser: false, stripePaymentId: "manual-x" }), undefined,
      [["pack_not_owned", "error"]]],
    // the payment itself
    ["a PaymentIntent Stripe does not have",   paid(),      null,                                              [["payment_not_found", "error"]]],
    ["a pack PaymentIntent Stripe does not have", packClass(), null,                                           [["payment_not_found", "error"]]],
    ["a payment that never succeeded",         paid(),      facts({ status: "requires_payment_method" }),      [["payment_not_succeeded", "error"]]],
    ["a fully refunded class",                 paid(),      facts({ amountRefunded: 4900 }),                   [["payment_refunded", "error"]]],
    ["a fully refunded pack",                  packClass(), packFacts({ amountRefunded: 22500 }),              [["payment_refunded", "error"]]],
    ["a partially refunded single class: an error", paid(), facts({ amountRefunded: 1000 }),                  [["payment_partially_refunded", "error"]]],
    ["a partially refunded pack: a review item",    packClass(), packFacts({ amountRefunded: 4500 }),         [["payment_partially_refunded", "review"]]],
    ["a disputed payment",                     paid(),      facts({ disputed: true }),                         [["payment_disputed", "error"]]],
    // payment_mismatch
    ["a 2h payment backing a 1h class",        paid(),      facts({ sessionDuration: "2h" }),                  [["payment_mismatch", "error"]]],
    ["a 1h payment backing a 2h class",        paid2h(),    facts2h({ sessionDuration: "1h" }),                [["payment_mismatch", "error"]]],
    ["a pack payment backing a single class",  paid(),      facts({ checkoutType: "pack", sessionDuration: null }), [["payment_mismatch", "error"]]],
    ["a single payment backing a pack class",  packClass(), packFacts({ checkoutType: "single" }),             [["payment_mismatch", "error"]]],
    ["another student's payment",              paid(),      facts({ studentEmail: "otro@example.com" }),        [["payment_mismatch", "error"]]],
    ["a payment with no metadata",             paid(),      facts({ checkoutType: null, sessionDuration: null, studentEmail: null }),
      [["payment_mismatch", "error"]]],
    // independent rules add up
    ["refunded and disputed",                  paid(),      facts({ amountRefunded: 4900, disputed: true }),
      [["payment_refunded", "error"], ["payment_disputed", "error"]]],
    ["too long and paid for the wrong duration", paid({ endsAt: at(120) }), facts({ sessionDuration: "2h" }),
      [["length_mismatch", "error"], ["payment_mismatch", "error"]]],
  ])("%s", (_name, booking, f, expected) => {
    expect(codes(booking, f)).toEqual(expected);
  });

  it("a finding names the booking, the student, the class and the payment checked", () => {
    const [finding] = evaluateBooking(packClass({ bookingId: "b-9" }), packFacts({ amountRefunded: 22500 }));
    expect(finding).toEqual({
      code:        "payment_refunded",
      severity:    "error",
      bookingId:   "b-9",
      email:       EMAIL,
      sessionType: "pack",
      startsAt:    START,
      paymentId:   "pi_pack",
      actual:      "amount_refunded=22500 of amount=22500",
    });
  });

  it("says what differs: expected vs. found", () => {
    expect(evaluateBooking(paid({ endsAt: at(120) }), facts())[0]).toMatchObject({
      code: "length_mismatch", expected: "60 min", actual: "120 min",
    });
    expect(evaluateBooking(paid(), facts({ sessionDuration: "2h", studentEmail: "otro@example.com" }))[0]).toMatchObject({
      code:      "payment_mismatch",
      paymentId: "pi_single",
      expected:  `session_duration=1h, student_email=${EMAIL}`,
      actual:    "session_duration=2h, student_email=otro@example.com",
    });
  });

  it("throws when a class points at a payment but no facts were passed (a caller bug, not a pass)", () => {
    expect(() => evaluateBooking(paid())).toThrow(/pi_single/);
    expect(() => evaluateBooking(packClass())).toThrow(/pi_pack/);
  });
});

// ─── auditUpcoming ───────────────────────────────────────────────────────────

const HOUR_MS = 3_600_000;
const DAY_MS  = 86_400_000;

function setup() {
  const bookings = new InMemoryBookingRepository();
  const stripe   = new FakeStripeClient();
  const email    = new FakeEmailClient();
  const service  = new BookingPaymentAuditService(bookings, stripe, email);
  return { service, bookings, stripe, email };
}

let seq = 0;
async function book(
  repo: InMemoryBookingRepository,
  opts: {
    sessionType:      SessionType;
    startMs?:         number;
    minutes?:         number;
    email?:           string;
    stripePaymentId?: string;
    creditPackId?:    string;
  },
): Promise<{ eventId: string; cancelToken: string }> {
  const n       = seq++;
  const eventId = `evt-${n}`;
  const start   = opts.startMs ?? Date.now() + DAY_MS + n * 3 * HOUR_MS;
  const minutes = opts.minutes ?? SESSION_DURATION_MINUTES[opts.sessionType];
  const { cancelToken } = await repo.createBooking({
    eventId,
    email:       opts.email ?? EMAIL,
    name:        "Ana",
    sessionType: opts.sessionType,
    startsAt:    new Date(start).toISOString(),
    endsAt:      new Date(start + minutes * 60_000).toISOString(),
    ...(opts.stripePaymentId ? { stripePaymentId: opts.stripePaymentId } : {}),
    ...(opts.creditPackId    ? { creditPackId:    opts.creditPackId    } : {}),
  });
  return { eventId, cancelToken };
}

describe("BookingPaymentAuditService.auditUpcoming", () => {
  it("a clean window: every type counted, manual pack classes counted, nothing found", async () => {
    const { service, bookings, stripe } = setup();
    stripe.seedAuditPayment("pi_1h", { studentEmail: EMAIL });
    stripe.seedAuditPayment("pi_2h", { studentEmail: EMAIL, sessionDuration: "2h" });
    stripe.seedAuditPayment("pi_pack", { studentEmail: EMAIL, checkoutType: "pack", sessionDuration: null });
    bookings.seedCreditPack({ id: "pack-paid",   ownerEmail: EMAIL, stripePaymentId: "pi_pack" });
    bookings.seedCreditPack({ id: "pack-manual", ownerEmail: EMAIL, stripePaymentId: "manual-6b1d" });

    await book(bookings, { sessionType: "free15min" });
    await book(bookings, { sessionType: "session1h", stripePaymentId: "pi_1h" });
    await book(bookings, { sessionType: "session2h", stripePaymentId: "pi_2h" });
    await book(bookings, { sessionType: "pack", creditPackId: "pack-paid" });
    await book(bookings, { sessionType: "pack", creditPackId: "pack-manual" });

    const report = await service.auditUpcoming();

    expect(report).toEqual({
      checked:           5,
      byType:            { free15min: 1, session1h: 1, session2h: 1, pack: 2 },
      manualPackClasses: 1,
      findings:          [],
    });
    // The free call and the manual pack need no Stripe call.
    expect([...stripe.auditCalls].sort()).toEqual(["pi_1h", "pi_2h", "pi_pack"]);
  });

  it("one Stripe call per distinct PaymentIntent: a pack backing several classes is checked once", async () => {
    const { service, bookings, stripe } = setup();
    stripe.seedAuditPayment("pi_pack", { studentEmail: EMAIL, checkoutType: "pack", sessionDuration: null });
    bookings.seedCreditPack({ id: "pack-1", ownerEmail: EMAIL, stripePaymentId: "pi_pack" });
    for (let i = 0; i < 10; i++) await book(bookings, { sessionType: "pack", creditPackId: "pack-1" });

    const report = await service.auditUpcoming();

    expect(report.checked).toBe(10);
    expect(report.findings).toEqual([]);
    expect(stripe.auditCalls).toEqual(["pi_pack"]);
  });

  it("a refunded pack flags every upcoming class drawn on it", async () => {
    const { service, bookings, stripe } = setup();
    stripe.seedAuditPayment("pi_pack", {
      studentEmail: EMAIL, checkoutType: "pack", sessionDuration: null, amount: 22500, amountRefunded: 22500,
    });
    bookings.seedCreditPack({ id: "pack-1", ownerEmail: EMAIL, stripePaymentId: "pi_pack" });
    const a = await book(bookings, { sessionType: "pack", creditPackId: "pack-1" });
    const b = await book(bookings, { sessionType: "pack", creditPackId: "pack-1" });

    const { findings } = await service.auditUpcoming();

    expect(findings.map(f => [f.bookingId, f.code])).toEqual([
      [a.eventId, "payment_refunded"],
      [b.eventId, "payment_refunded"],
    ]);
    expect(stripe.auditCalls).toEqual(["pi_pack"]);
  });

  it("a PaymentIntent Stripe does not have (resource_missing → null) is payment_not_found", async () => {
    const { service, bookings, stripe } = setup();
    const { eventId } = await book(bookings, { sessionType: "session1h", stripePaymentId: "pi_gone" });

    const { findings } = await service.auditUpcoming();

    expect(findings).toEqual([expect.objectContaining({
      code: "payment_not_found", bookingId: eventId, paymentId: "pi_gone",
    })]);
    expect(stripe.auditCalls).toEqual(["pi_gone"]);
  });

  it("any other Stripe error rejects the run instead of reporting on what it could check", async () => {
    const { service, bookings, stripe, email } = setup();
    stripe.seedAuditPayment("pi_ok", { studentEmail: EMAIL });
    stripe.failAuditFor("pi_down", new Error("Stripe 500"));
    await book(bookings, { sessionType: "session1h", stripePaymentId: "pi_ok" });
    await book(bookings, { sessionType: "session1h", stripePaymentId: "pi_down" });

    await expect(service.auditUpcoming()).rejects.toThrow("Stripe 500");
    expect(email.sent).toEqual([]);
  });

  it("a failed booking read rejects the run and calls Stripe for nothing", async () => {
    const { service, bookings, stripe } = setup();
    await book(bookings, { sessionType: "session1h", stripePaymentId: "pi_1h" });
    bookings.listUpcomingForPaymentAuditShouldFail = true;

    await expect(service.auditUpcoming()).rejects.toThrow("simulated read failure");
    expect(stripe.auditCalls).toEqual([]);
  });

  it("the horizon is the booking window: a class starting after it is not read", async () => {
    const { service, bookings, stripe } = setup();
    const now    = Date.now();
    const window = BOOKING_WINDOW_WEEKS * 7 * DAY_MS;
    stripe.seedAuditPayment("pi_inside", { studentEmail: EMAIL });
    await book(bookings, { sessionType: "session1h", stripePaymentId: "pi_inside", startMs: now + window - HOUR_MS });
    await book(bookings, { sessionType: "session1h", stripePaymentId: "pi_beyond", startMs: now + window + HOUR_MS });

    const report = await service.auditUpcoming(now);

    expect(report.checked).toBe(1);
    expect(report.findings).toEqual([]);
    expect(stripe.auditCalls).toEqual(["pi_inside"]);
  });

  it("past, cancelled, completed and no-show bookings are not audited", async () => {
    const { service, bookings, stripe } = setup();
    // None of these PaymentIntents is seeded: had any been audited, it would be a finding.
    await book(bookings, { sessionType: "session1h", stripePaymentId: "pi_past", startMs: Date.now() - DAY_MS });
    const cancelled = await book(bookings, { sessionType: "session1h", stripePaymentId: "pi_cancelled" });
    await bookings.consumeCancelToken(cancelled.cancelToken);
    const completed = await book(bookings, { sessionType: "session1h", stripePaymentId: "pi_completed" });
    await bookings.markCompleted(completed.eventId);
    const noShow = await book(bookings, { sessionType: "session1h", stripePaymentId: "pi_noshow" });
    await bookings.markNoShow(noShow.eventId);

    const report = await service.auditUpcoming();

    expect(report.checked).toBe(0);
    expect(report.findings).toEqual([]);
    expect(stripe.auditCalls).toEqual([]);
  });

  it("writes nothing: no booking, credit, payment or Stripe object is touched, and no email is sent", async () => {
    const { service, bookings, stripe, email } = setup();
    stripe.seedAuditPayment("pi_refunded", { studentEmail: EMAIL, amountRefunded: 4900 });
    const { eventId } = await book(bookings, { sessionType: "session1h", stripePaymentId: "pi_refunded" });
    await book(bookings, { sessionType: "session2h" }); // no link → a finding too

    const writes = [
      jest.spyOn(bookings, "createBooking"),
      jest.spyOn(bookings, "consumeCancelToken"),
      jest.spyOn(bookings, "cancelByToken"),
      jest.spyOn(bookings, "reinstateBooking"),
      jest.spyOn(bookings, "markCompleted"),
      jest.spyOn(bookings, "markNoShow"),
      jest.spyOn(stripe, "createRefund"),
      jest.spyOn(stripe, "createPaymentIntent"),
    ];

    const report = await service.auditUpcoming();

    expect(report.findings.map(f => f.code)).toEqual(["payment_refunded", "no_payment_link"]);
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    expect(stripe.refunds).toEqual([]);
    expect(email.sent).toEqual([]);
    expect(await bookings.findByEventId(eventId)).toEqual({ id: eventId, status: "confirmed" });
  });

  it(`keeps at most ${AUDIT_STRIPE_CONCURRENCY} Stripe calls in flight and still checks every payment once`, async () => {
    const { service, bookings, stripe } = setup();
    let inFlight = 0;
    let maxInFlight = 0;
    const retrieve = jest.spyOn(stripe, "retrievePaymentForAudit").mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(resolve => setTimeout(resolve, 5));
      inFlight--;
      return {
        status: "succeeded", amount: 4900, amountRefunded: 0, disputed: false,
        checkoutType: "single", sessionDuration: "1h", studentEmail: EMAIL,
      };
    });
    for (let i = 0; i < 12; i++) await book(bookings, { sessionType: "session1h", stripePaymentId: `pi_${i}` });

    const report = await service.auditUpcoming();

    expect(report.findings).toEqual([]);
    expect(retrieve).toHaveBeenCalledTimes(12);
    expect(maxInFlight).toBe(AUDIT_STRIPE_CONCURRENCY);
  });
});

describe("BookingPaymentAuditService.emailReport", () => {
  it("sends the report to the tutor through the email client", async () => {
    const { service, email } = setup();
    const report = {
      checked: 1, byType: { free15min: 0, session1h: 1, session2h: 0, pack: 0 }, manualPackClasses: 0,
      findings: evaluateBooking(paid(), null),
    };

    await service.emailReport(report);

    expect(email.sent).toEqual([{ type: "paymentAuditReport", params: report }]);
  });
});
