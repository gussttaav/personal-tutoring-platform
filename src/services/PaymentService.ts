/**
 * ARCH-14: PaymentService — consolidates all Stripe-facing business logic.
 *
 * Extracted from:
 *   - src/lib/single-session.ts  (single-session webhook processing)
 *   - src/app/api/stripe/checkout/route.ts  (PaymentIntent creation)
 *   - src/app/api/stripe/session/route.ts   (payment confirmation retrieval)
 *   - src/app/api/stripe/webhook/route.ts   (event dispatch + pack payment)
 *   - src/app/api/admin/failed-bookings/route.ts  (dead-letter retry)
 *
 * Route handlers are now thin adapters: parse → call service → return response.
 *
 * REFACTOR-R3-P1-02: the webhook slot re-check fails CLOSED — a Google freebusy
 * failure now propagates (webhook 500 → Stripe redelivers) instead of assuming the
 * slot is free, so a transient outage can't double-book the tutor's manual calendar.
 *
 * REFACTOR-R3-P1-03: the idempotency gate short-circuits on an existing booking
 * for the PaymentIntent (any status since REFACTOR-R4-P1-02) — so a redelivery after createBooking committed but
 * markProcessed failed heals the marker instead of refunding a fulfilled booking.
 *
 * REFACTOR-R3-P3-03: `getConfirmationChannelState` absorbs the logic that used to sit
 * in GET /api/payment-confirmation/channel — which built its own `new Stripe(...)`
 * client inline instead of going through IStripeClient.
 *
 * REFACTOR-R4-P1-01: checkout validates the slot (BookingService.assertSlotBookable:
 * length, grid, hours, notice — no network) before any PaymentIntent exists, and the
 * webhook books an end DERIVED from the paid duration — the metadata `end_iso` is never
 * booked, so a "1h" payment can no longer yield a longer class. The webhook's freebusy
 * re-check is unchanged apart from asking for the tutor-timezone day.
 *
 * REFACTOR-R4-P1-02: the webhook's idempotency reads fail CLOSED — isProcessed,
 * the booking-exists gate and wasRefunded throw on a DB error (webhook 500 → Stripe
 * redelivers) instead of reading as "absent" and falling through to a refund. The
 * booking-exists gate is now status-agnostic (hasBookingForPayment): a cancelled
 * booking for the PaymentIntent is proof of processing too.
 *
 * REFACTOR-R4-P3-01: `reconcileRecentPayments` absorbs the reconciliation cron's logic
 * (the route called the stripe singleton and three repositories directly), and a
 * slot-taken refund (single_session_refunds) now counts as proof of handling — it never
 * writes the processed marker, so every such refund used to raise a false Sentry error.
 * The dead-letter retry now carries the charged amount + currency, so a recovered
 * booking gets its `payments` row like any webhook-booked one.
 *
 * DEAD-LETTER-RETRY-01: a retry whose booking fails again no longer reports success.
 * processSingleSession dead-letters that failure itself (upsert, same key) and returns
 * normally, and reprocessFailedBooking used to clear the entry and answer { ok: true } —
 * so the admin saw "procesado", the entry vanished, and the student had paid for a class
 * that did not exist. processSingleSession now returns its outcome; the retry clears the
 * entry only when the payment is resolved (booked, already handled, or refunded).
 *
 * DEAD-LETTER-RETRY-02: a successful retry also says HOW it resolved (`outcome`), so the
 * admin's RetryButton can tell "booked" from "the slot was taken, the student was refunded"
 * — both used to read «Procesado correctamente».
 *
 * REFACTOR-R4-P4-01: the slot-taken refund carries an idempotency key
 * (`refund:slot_taken:<pi>`), so a redelivery after recordSlotTakenRefund failed replays the
 * SAME refund and records it — it used to get charge_already_refunded and 500 for days. The
 * checkout keys include the amount + currency: since PRICING-STUDENT-01 an admin price edit
 * inside the 5-min window reused the key with a different amount, which Stripe rejects.
 *
 * BOOKING-ATTRIBUTION-01: a single-session checkout puts the student's first-touch source
 * in the PaymentIntent metadata (utm_source / utm_medium / utm_campaign / referrer_host /
 * landing_path); every path that books from a PaymentIntent or legacy Checkout Session
 * (webhook, admin retry) reads it back and hands it to createBooking. Metadata is part of
 * the request Stripe compares on an idempotent replay, so a non-empty source also goes
 * into the checkout key (as a short hash; keys without a source are unchanged).
 */

import type Stripe from "stripe";
import type { IPaymentRepository, FailedBookingEntry } from "@/domain/repositories/IPaymentRepository";
import type {
  BookingAttribution, PackSize, PaymentCheckoutType, SingleSessionBookingDetail,
  SingleSessionResolved, SingleSessionStatusResult,
} from "@/domain/types";
import type { IStripeClient } from "@/infrastructure/stripe/StripeClient";
import { getAvailableSlots } from "@/infrastructure/google";
import { formatInTimeZone } from "date-fns-tz";
import { log } from "@/lib/logger";
import { attributionFromMetadata, attributionToMetadata } from "@/lib/attribution";
import { createHash } from "crypto";
import { paymentChannelName } from "@/lib/realtime-channel";
import { PermanentWebhookError } from "@/domain/errors";
import { SESSION_DURATION_MINUTES } from "@/lib/booking-config";
import { sendDeadLetterNotificationEmail } from "@/infrastructure/resend/email-functions";
import { CreditService } from "./CreditService";
import { BookingService } from "./BookingService";
import { UserService } from "./UserService";
import { PricingService } from "./PricingService";
import { ScheduleService } from "./ScheduleService";

// ─── Public output types ──────────────────────────────────────────────────────

export interface CheckoutResult {
  clientSecret:    string | null;
  paymentIntentId: string;
}

export interface PackPaymentSummary {
  checkoutType: "pack";
  email:        string;
  name:         string;
  packSize:     number;
}

export interface SinglePaymentSummary {
  checkoutType:    "single";
  email:           string;
  name:            string;
  sessionDuration: string;
}

export type PaymentSummary = PackPaymentSummary | SinglePaymentSummary;

// REFACTOR-R4-P3-01: one entry of the reconciliation cron's `details` — the route
// serializes these verbatim, so the field set is the cron's response contract.
export interface ReconcileMismatch {
  paymentIntentId: string;
  amount:          number;
  currency:        string;
  email?:          string;
  createdAt:       string;
  reason:          "no_credit_pack" | "no_booking" | "no_webhook_row";
}

export interface ReconcileResult {
  scanned:    number;
  mismatches: ReconcileMismatch[];
  hitPageCap: boolean;
}

// REFACTOR-R3-P3-03: the response body of GET /api/payment-confirmation/channel.
// This union IS the wire contract (the mobile app consumes the single branch), so the
// route serializes it verbatim — no per-branch assembly in the handler. Note the pack
// variant deliberately carries no `checkoutType`: the shipped pack response never had
// one, and adding it would move a contract the mobile client already parses.
export type ConfirmationChannelState =
  | {
      channelName:  string;
      checkoutType: "single";
      status:       SingleSessionStatusResult["status"];
      booking?:     SingleSessionBookingDetail;
    }
  | {
      channelName: string;
      confirmed:   boolean;
      credits:     number | null;
      name:        string;
      packSize:    number;
    };

// ─── Internal types ───────────────────────────────────────────────────────────

interface SingleSessionInput {
  email:           string;
  name:            string;
  startIso:        string;
  endIso:          string;
  duration:        string;
  rescheduleToken: string | null;
  idempotencyKey:  string;
  refundTarget:    { payment_intent?: string; charge?: string };
  // PAYMENTS-AUDIT-01: charged amount from the Stripe event (intent.amount /
  // session.amount_total). Used to record the `payments` audit row on success.
  // Nullable: legacy checkout.session may lack amount_total.
  amountCents?:    number | null;
  currency?:       string | null;
  attribution?:    BookingAttribution; // BOOKING-ATTRIBUTION-01
}

// DEAD-LETTER-RETRY-01: how processSingleSession resolved the payment. Only the admin
// retry reads it — the webhook answers 200 either way (a dead-letter is a handled failure).
type SingleSessionOutcome =
  | { status: ResolvedRetryOutcome }
  | { status: "dead_lettered"; error: string };

// DEAD-LETTER-RETRY-02: the `outcome` of a successful admin retry (POST
// /api/admin/failed-bookings returns it verbatim; RetryButton reads it).
export type ResolvedRetryOutcome = "booked" | "already_handled" | "refunded";

// ─── Service ──────────────────────────────────────────────────────────────────

export class PaymentService {
  constructor(
    private readonly stripeClient: IStripeClient,
    private readonly credits:      CreditService,
    private readonly bookings:     BookingService,
    private readonly paymentRepo:  IPaymentRepository,
    private readonly userService:  UserService,
    private readonly pricing:      PricingService,
    private readonly schedule:     ScheduleService,
  ) {}

  // ── Checkout ───────────────────────────────────────────────────────────────

  async createPackCheckout(params: {
    email: string; name: string; packSize: PackSize;
  }): Promise<CheckoutResult> {
    const { email, name, packSize } = params;
    // PRICING-STUDENT-01: resolve the student so any private price of theirs is
    // what Stripe is charged. No row (or no override) → the public price.
    const user = await this.userService.findByEmail(email);
    const { amount, currency } = await this.pricing.getAmount(
      packSize === 5 ? "pack5" : "pack10",
      user?.id,
    );
    // REFACTOR-P1-05: 5-min window deduplicates double-clicks; deliberate retry
    // after window gets a fresh PI.
    // REFACTOR-R4-P4-01: the amount is part of the key. Since PRICING-STUDENT-01 it can change
    // between two clicks (admin edit); an unchanged key with a changed amount is a Stripe error.
    const bucket = Math.floor(Date.now() / 300_000);
    const idempotencyKey = `pack:${email}:${packSize}:${amount}${currency}:${bucket}`;
    const intent = await this.stripeClient.createPaymentIntent(
      {
        amount,
        currency,
        metadata: {
          student_name:  name,
          student_email: email,
          pack_size:     String(packSize),
          checkout_type: "pack",
        },
      },
      { idempotencyKey },
    );
    return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
  }

  async createSingleSessionCheckout(params: {
    email:           string;
    name:            string;
    duration:        "1h" | "2h";
    startIso:        string;
    endIso:          string;
    rescheduleToken?: string;
    attribution?:    BookingAttribution;
  }): Promise<CheckoutResult> {
    const { email, name, duration, startIso, endIso, rescheduleToken, attribution } = params;
    // REFACTOR-R4-P1-01: never take money for a slot the server would not book.
    const sessionType = duration === "1h" ? "session1h" : "session2h";
    await this.bookings.assertSlotBookable({ startIso, endIso, sessionType });
    // PRICING-STUDENT-01: see createPackCheckout.
    const user = await this.userService.findByEmail(email);
    const { amount, currency } = await this.pricing.getAmount(sessionType, user?.id);
    // REFACTOR-P1-05: startIso in key prevents collision between genuinely
    // different slots for the same user/duration within the same 5-min window.
    // REFACTOR-R4-P4-01: amount + currency in the key — see createPackCheckout.
    const bucket = Math.floor(Date.now() / 300_000);
    const sourceMetadata = attributionToMetadata(attribution); // BOOKING-ATTRIBUTION-01
    const sourceKey = Object.keys(sourceMetadata).length > 0
      ? `:${createHash("sha256").update(JSON.stringify(sourceMetadata)).digest("hex").slice(0, 12)}`
      : "";
    const idempotencyKey =
      `single:${email}:${duration}:${startIso}:${amount}${currency}:${bucket}${sourceKey}`;
    const intent = await this.stripeClient.createPaymentIntent(
      {
        amount,
        currency,
        metadata: {
          student_name:     name,
          student_email:    email,
          checkout_type:    "single",
          session_duration: duration,
          start_iso:        startIso,
          end_iso:          endIso,
          reschedule_token: rescheduleToken ?? "",
          ...sourceMetadata,
        },
      },
      { idempotencyKey },
    );
    return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
  }

  // ── Session confirmation ───────────────────────────────────────────────────

  async getConfirmedPayment(params: {
    paymentIntentId:    string;
    authenticatedEmail: string;
  }): Promise<PaymentSummary> {
    const { paymentIntentId, authenticatedEmail } = params;
    const intent = await this.stripeClient.retrievePaymentIntent(paymentIntentId);

    const intentEmail = intent.metadata?.student_email ?? "";
    if (intentEmail.toLowerCase().trim() !== authenticatedEmail.toLowerCase().trim()) {
      log("warn", "Unauthorized /stripe/session access attempt", {
        service: "payment", authenticatedEmail, paymentIntentId,
      });
      throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    }

    if (intent.status !== "succeeded") {
      throw Object.assign(new Error("Pago no completado"), { statusCode: 402 });
    }

    const email        = intent.metadata?.student_email ?? "";
    const name         = intent.metadata?.student_name  ?? "";
    const checkoutType = intent.metadata?.checkout_type ?? "pack";

    if (!email) throw Object.assign(new Error("Datos de sesión incompletos"), { statusCode: 400 });

    if (checkoutType === "pack") {
      const packSize = parseInt(intent.metadata?.pack_size ?? "0", 10);
      return { checkoutType: "pack", email, name, packSize };
    }

    const sessionDuration = intent.metadata?.session_duration ?? "";
    return { checkoutType: "single", email, name, sessionDuration };
  }

  // ── Webhook ────────────────────────────────────────────────────────────────

  verifyWebhookSignature(body: string, sig: string, secret: string): Stripe.Event {
    return this.stripeClient.verifyWebhookSignature(body, sig, secret);
  }

  async processWebhookEvent(event: Stripe.Event): Promise<void> {
    // ── payment_intent.succeeded (embedded PaymentElement flow) ──────────────
    if (event.type === "payment_intent.succeeded") {
      const intent       = event.data.object as Stripe.PaymentIntent;
      const metadata     = intent.metadata as Record<string, string>;
      const checkoutType = metadata.checkout_type ?? "pack";

      if (checkoutType === "pack") {
        await this.handlePackPayment(metadata, intent.id, intent.amount, intent.currency);
        return;
      }
      if (checkoutType === "single") {
        await this.processSingleSession({
          email:           metadata.student_email ?? "",
          name:            metadata.student_name  ?? "",
          startIso:        metadata.start_iso     ?? "",
          endIso:          metadata.end_iso       ?? "",
          duration:        metadata.session_duration ?? "1h",
          rescheduleToken: metadata.reschedule_token || null,
          idempotencyKey:  intent.id,
          refundTarget:    { payment_intent: intent.id },
          amountCents:     intent.amount,
          currency:        intent.currency,
          attribution:     attributionFromMetadata(metadata),
        });
      }
      return;
    }

    // ── checkout.session.completed (legacy redirect flow — kept for backward compat) ──
    if (event.type === "checkout.session.completed") {
      const session         = event.data.object as Stripe.Checkout.Session;
      const email           = session.metadata?.student_email ?? session.customer_email ?? "";
      const name            = session.metadata?.student_name  ?? "";
      const checkoutType    = session.metadata?.checkout_type ?? "pack";
      const stripeSessionId = session.id;

      if (!email) {
        log("error", "Missing email in webhook metadata", { service: "payment", stripeSessionId });
        throw new PermanentWebhookError(`Missing student_email in metadata for ${stripeSessionId}`);
      }

      if (checkoutType === "pack") {
        const packSize = parseInt(session.metadata?.pack_size ?? "0", 10);
        if (!packSize) {
          log("error", "Missing pack_size in webhook metadata", { service: "payment", stripeSessionId });
          throw new PermanentWebhookError(`Missing pack_size in metadata for ${stripeSessionId}`);
        }
        await this.handlePackPayment(
          { student_email: email, student_name: name, pack_size: String(packSize), checkout_type: "pack" },
          stripeSessionId,
          session.amount_total,
          session.currency,
        );
        return;
      }

      if (checkoutType === "single") {
        await this.processSingleSession({
          email,
          name,
          startIso:        session.metadata?.start_iso        ?? "",
          endIso:          session.metadata?.end_iso          ?? "",
          duration:        session.metadata?.session_duration ?? "1h",
          rescheduleToken: session.metadata?.reschedule_token || null,
          idempotencyKey:  stripeSessionId,
          refundTarget:    { payment_intent: session.payment_intent as string },
          amountCents:     session.amount_total,
          currency:        session.currency,
          attribution:     attributionFromMetadata(session.metadata),
        });
      }
    }
  }

  // ── Admin dead-letter retry ────────────────────────────────────────────────

  async reprocessFailedBooking(
    stripeSessionId: string,
  ): Promise<{ ok: boolean; error?: string; outcome?: ResolvedRetryOutcome }> {
    const entries = await this.paymentRepo.listFailedBookings();
    const entry   = entries.find(e => e.stripeSessionId === stripeSessionId);
    if (!entry) return { ok: false, error: "Not found" };

    log("info", "Reprocessing failed booking", { service: "payment", stripeSessionId });

    let input: SingleSessionInput;
    try {
      if (stripeSessionId.startsWith("pi_")) {
        const intent   = await this.stripeClient.retrievePaymentIntent(stripeSessionId);
        const metadata = intent.metadata as Record<string, string>;
        input = {
          email:           metadata.student_email  ?? "",
          name:            metadata.student_name   ?? "",
          startIso:        metadata.start_iso      ?? "",
          endIso:          metadata.end_iso        ?? "",
          duration:        metadata.session_duration ?? "1h",
          rescheduleToken: metadata.reschedule_token || null,
          idempotencyKey:  stripeSessionId,
          refundTarget:    { payment_intent: stripeSessionId },
          // REFACTOR-R4-P3-01: without these, recordPaymentRow skipped the audit row.
          amountCents:     intent.amount,
          currency:        intent.currency,
          attribution:     attributionFromMetadata(metadata),
        };
      } else {
        const checkout = await this.stripeClient.retrieveCheckoutSession(stripeSessionId);
        const metadata = (checkout.metadata ?? {}) as Record<string, string>;
        input = {
          email:           metadata.student_email ?? checkout.customer_email ?? "",
          name:            metadata.student_name  ?? "",
          startIso:        metadata.start_iso     ?? "",
          endIso:          metadata.end_iso       ?? "",
          duration:        metadata.session_duration ?? "1h",
          rescheduleToken: metadata.reschedule_token || null,
          idempotencyKey:  stripeSessionId,
          refundTarget:    { payment_intent: checkout.payment_intent as string },
          amountCents:     checkout.amount_total,
          currency:        checkout.currency,
          attribution:     attributionFromMetadata(metadata),
        };
      }
    } catch (err) {
      log("error", "Failed to retrieve Stripe entity for retry", { service: "payment", stripeSessionId, error: String(err) });
      return { ok: false, error: "Failed to retrieve Stripe data" };
    }

    try {
      const outcome = await this.processSingleSession(input);
      // DEAD-LETTER-RETRY-01: the booking failed again and processSingleSession already
      // re-wrote the entry with the new error. Keep it — clearing would lose the payment.
      if (outcome.status === "dead_lettered") {
        log("warn", "Dead-letter retry did not succeed", { service: "payment", stripeSessionId, error: outcome.error });
        return { ok: false, error: outcome.error };
      }
      await this.paymentRepo.clearFailedBooking(stripeSessionId);
      log("info", "Dead-letter entry cleared after successful retry", {
        service: "payment", stripeSessionId, outcome: outcome.status,
      });
      return { ok: true, outcome: outcome.status };
    } catch (err) {
      log("warn", "Dead-letter retry did not succeed", { service: "payment", stripeSessionId, error: String(err) });
      return { ok: false, error: String(err) };
    }
  }

  async listFailedBookings(): Promise<FailedBookingEntry[]> {
    return this.paymentRepo.listFailedBookings();
  }

  // ── Reconciliation cron ────────────────────────────────────────────────────

  // REFACTOR-R4-P3-01: moved from GET /api/internal/reconcile-stripe (REFACTOR-P4-01).
  // Lists the succeeded PaymentIntents of the last `lookbackHours` and checks each was
  // processed downstream. Proof is type-aware — see the route header. Read-only; the
  // reads throw on a DB error (REFACTOR-R4-P1-02), so a blip fails the run instead of
  // producing false mismatches.
  async reconcileRecentPayments(opts: {
    lookbackHours: number;
    pageSize:      number;
    maxPages:      number;
  }): Promise<ReconcileResult> {
    const createdGte = Math.floor((Date.now() - opts.lookbackHours * 3600_000) / 1000);
    const mismatches: ReconcileMismatch[] = [];
    let scanned = 0;
    let startingAfter: string | undefined;
    let pageCount = 0;

    while (pageCount < opts.maxPages) {
      const page = await this.stripeClient.listPaymentIntents({
        createdGte,
        limit: opts.pageSize,
        ...(startingAfter ? { startingAfter } : {}),
      });
      pageCount++;

      for (const pi of page.data) {
        scanned++;
        if (pi.status !== "succeeded") continue;

        const checkoutType = pi.metadata?.checkout_type;
        const base = {
          paymentIntentId: pi.id,
          amount:          pi.amount,
          currency:        pi.currency,
          email:           pi.metadata?.student_email,
          createdAt:       new Date(pi.created * 1000).toISOString(),
        };

        if (checkoutType === "pack") {
          // Proof: the pack's credit_packs row (idempotency anchor).
          if (!(await this.credits.hasProcessedPayment(pi.id))) {
            mismatches.push({ ...base, reason: "no_credit_pack" });
          }
        } else if (checkoutType === "single") {
          // Proof: a booking, a slot-taken refund, a known dead-letter, or the processed
          // marker. The refund path never marks processed, and the PI stays `succeeded`
          // after a refund — without the refund check it read as a dropped webhook.
          const handled =
            (await this.bookings.hasBookingForPayment(pi.id)) ||
            (await this.paymentRepo.wasRefunded(pi.id)) ||
            (await this.paymentRepo.hasFailedBooking(pi.id)) ||
            (await this.paymentRepo.isProcessed(pi.id));
          if (!handled) {
            mismatches.push({ ...base, reason: "no_booking" });
          }
        } else {
          // Unknown/missing checkout_type — fall back to the webhook ledger.
          if (!(await this.paymentRepo.isProcessed(pi.id))) {
            mismatches.push({ ...base, reason: "no_webhook_row" });
          }
        }
      }

      if (!page.hasMore) break;
      startingAfter = page.data[page.data.length - 1]?.id;
    }

    return { scanned, mismatches, hitPageCap: pageCount === opts.maxPages };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async handlePackPayment(
    metadata: Record<string, string>,
    intentId: string,
    amountCents: number | null | undefined,
    currency: string | null | undefined,
  ): Promise<void> {
    const email    = metadata.student_email ?? "";
    const name     = metadata.student_name  ?? "";
    const packSize = parseInt(metadata.pack_size ?? "0", 10);

    if (!email) {
      log("error", "Missing email in pack payment metadata", { service: "payment", intentId });
      throw new PermanentWebhookError(`Missing student_email in pack metadata for ${intentId}`);
    }
    if (!packSize) {
      log("warn", "Missing pack_size in metadata", { service: "payment", intentId });
      throw new PermanentWebhookError(`Missing pack_size in metadata for ${intentId}`);
    }

    // Resolve the pack's redeemability deadline from the admin-editable
    // pack-validity setting (pricing_settings.pack_validity_days) and freeze it on
    // this pack at purchase time. Changing the setting only affects future packs.
    const validityDays = await this.pricing.getPackValidityDays();
    const expiresAt    = new Date(Date.now() + validityDays * 24 * 60 * 60_000).toISOString();

    await this.credits.addCredits({
      email, name, amount: packSize,
      packLabel: `Pack ${packSize} clases`, stripeSessionId: intentId,
      expiresAt,
    });
    log("info", "Pack credits written", { service: "payment", email, packSize, validityDays });

    // PAYMENTS-AUDIT-01: intentId is the credit_packs.stripe_payment_id, which is
    // exactly the key the history/admin surfaces join `payments` on.
    await this.recordPaymentRow({
      email, name, stripePaymentId: intentId, amountCents, currency, checkoutType: "pack",
    });

    // REFACTOR-P3-05: Broadcast for live confirmation. Best-effort — credits are
    // already persisted above, so a broadcast failure just means the browser falls
    // back to the channel-endpoint state check on (re)subscribe.
    try {
      const balance = await this.credits.getBalance(email);
      await this.credits.broadcastPaymentConfirmed(intentId, {
        credits:  balance?.credits  ?? packSize,
        name:     balance?.name     ?? name,
        packSize: balance?.packSize ?? packSize,
      });
    } catch (err) {
      log("warn", "Realtime payment broadcast failed (browser will catch up via channel endpoint)", {
        service: "payment", intentId, error: String(err),
      });
    }
  }

  private async processSingleSession(input: SingleSessionInput): Promise<SingleSessionOutcome> {
    const { email, name, startIso, endIso, duration, rescheduleToken, idempotencyKey } = input;
    // SINGLE-SESSION-CONFIRM-01: the PaymentIntent id is the channel seed + the key the
    // mobile client polls by (booking.stripe_payment_id, single_session_refunds).
    const paymentIntentId = input.refundTarget.payment_intent;

    if (!email) {
      log("error", "Missing email in single-session metadata", { service: "payment", idempotencyKey });
      throw new PermanentWebhookError(`Missing student_email in single-session metadata for ${idempotencyKey}`);
    }
    if (!startIso || !endIso) {
      log("error", "Missing slot timing in webhook metadata", { service: "payment", idempotencyKey });
      throw new PermanentWebhookError(`Missing start_iso or end_iso in metadata for ${idempotencyKey}`);
    }

    // Idempotency check
    if (await this.paymentRepo.isProcessed(idempotencyKey)) {
      log("info", "Duplicate single-session webhook skipped", { service: "payment", idempotencyKey });
      return { status: "already_handled" };
    }

    // REFACTOR-R3-P1-03: createBooking and markProcessed are separate writes. If the
    // booking committed but markProcessed failed, Stripe's redelivery must NOT reach the
    // slot re-check (it would see our own calendar event and refund a fulfilled booking).
    // A booking for this PI is proof of processing — heal the marker and stop.
    // REFACTOR-R4-P1-02: status-agnostic. A cancelled booking for this PI is still proof of
    // processing — re-running would re-book a slot the student already gave back.
    if (paymentIntentId && await this.bookings.hasBookingForPayment(paymentIntentId)) {
      await this.paymentRepo.markProcessed(idempotencyKey).catch(() => {});
      log("info", "Duplicate single-session webhook skipped (booking already exists)", {
        service: "payment", idempotencyKey,
      });
      return { status: "already_handled" };
    }

    // SINGLE-SESSION-CONFIRM-01: a prior run already refunded this PaymentIntent for a taken
    // slot (the refund path does not markProcessed). Short-circuit so a duplicate webhook
    // never attempts a second refund.
    if (paymentIntentId && await this.paymentRepo.wasRefunded(paymentIntentId)) {
      log("info", "Duplicate single-session webhook skipped (already refunded)", { service: "payment", idempotencyKey });
      return { status: "refunded" };
    }

    // REFACTOR-R4-P1-01: the booked window is DERIVED from the paid duration — the
    // metadata end_iso is never booked, so what was paid for is what gets booked.
    const sessionType     = duration === "2h" ? "session2h" as const : "session1h" as const;
    const durationMinutes = SESSION_DURATION_MINUTES[sessionType];
    const startMs         = new Date(startIso).getTime();
    if (Number.isNaN(startMs)) {
      log("error", "Unparseable start_iso in webhook metadata", { service: "payment", idempotencyKey });
      throw new PermanentWebhookError(`Unparseable start_iso in metadata for ${idempotencyKey}`);
    }
    const endIsoSafe = new Date(startMs + durationMinutes * 60_000).toISOString();

    // Slot re-check — refund if slot was taken in the meantime
    const scheduleConfig  = await this.schedule.getConfig();
    // REFACTOR-R4-P1-01: the tutor-timezone day, not the UTC date of startIso.
    const slotDate        = formatInTimeZone(new Date(startMs), scheduleConfig.timezone, "yyyy-MM-dd");
    // REFACTOR-R3-P1-02: fail CLOSED. A freebusy failure is retryable (webhook 500 →
    // Stripe redelivers), never "assume free": the exclusion constraint doesn't cover
    // the tutor's manual calendar blocks.
    const availableSlots  = await getAvailableSlots(slotDate, durationMinutes, scheduleConfig, 30);
    // Compare instants, not strings: "…:00Z" and "…:00.000Z" are the same start.
    const slotStillFree   = availableSlots.some(s => new Date(s.start).getTime() === startMs);

    if (!slotStillFree) {
      log("warn", "Slot no longer available — refunding", { service: "payment", email, startIso, idempotencyKey });
      // REFACTOR-R4-P4-01: keyed by the PI, so a redelivery after a failed record below gets
      // the same refund back (Stripe keeps keys 24h) instead of charge_already_refunded.
      await this.stripeClient.createRefund(
        { ...input.refundTarget, reason: "duplicate" },
        { idempotencyKey: `refund:slot_taken:${input.refundTarget.payment_intent ?? input.refundTarget.charge}` },
      );
      // SINGLE-SESSION-CONFIRM-01: persist the queryable refund record (right after the
      // refund actually issued, so the record only ever means "money returned"), then
      // best-effort broadcast. Persistence precedes the fire-and-forget broadcast.
      if (paymentIntentId) {
        await this.paymentRepo.recordSlotTakenRefund(paymentIntentId);
        await this.broadcastResolved(paymentIntentId, { status: "slot_taken" });
      }
      return { status: "refunded" };
    }

    // Guarantee the user record exists before the booking attempt so the
    // dead-letter entry can reference users.id even if createBooking fails.
    const userId = await this.userService.ensureUser(email, name);

    try {
      // SINGLE-SESSION-CONFIRM-01: capture the booking output (previously discarded) so the
      // success broadcast can carry the join capability + timing the mobile S08 screen needs.
      const booking = await this.bookings.createBooking({
        email,
        name,
        startIso,
        endIso:           endIsoSafe,
        sessionType,
        rescheduleToken:  rescheduleToken ?? undefined,
        stripePaymentId:  paymentIntentId,
        attribution:      input.attribution,
      });
      await this.paymentRepo.markProcessed(idempotencyKey);
      log("info", "Single session booked", { service: "payment", email, startIso });

      // PAYMENTS-AUDIT-01: paymentIntentId is the booking's stripe_payment_id, the
      // key the history/admin surfaces join `payments` on. Only the successful-booking
      // path records — refund/slot-taken/dead-letter exits above deliberately do not.
      await this.recordPaymentRow({
        email, name, stripePaymentId: paymentIntentId ?? idempotencyKey,
        amountCents: input.amountCents, currency: input.currency, checkoutType: "single",
      });

      // SINGLE-SESSION-CONFIRM-01: best-effort confirmation broadcast (persistence above
      // already committed the booking; polling catches up if this is missed).
      if (paymentIntentId) {
        await this.broadcastResolved(paymentIntentId, {
          status:      "confirmed",
          eventId:     booking.eventId,
          startIso,
          endIso:      endIsoSafe,
          sessionType,
          joinToken:   booking.joinToken,
          emailFailed: booking.emailFailed,
        });
      }
      return { status: "booked" };
    } catch (err) {
      log("error", "Booking failed after payment — writing dead-letter", { service: "payment", email, startIso, idempotencyKey, error: String(err) });
      await this.writeDeadLetter(idempotencyKey, userId, startIso, err, email);
      // SINGLE-SESSION-CONFIRM-01: tell a subscribed client to leave "confirmando pago"
      // (manual recovery handles the rest — polling is the source of truth).
      if (paymentIntentId) {
        await this.broadcastResolved(paymentIntentId, { status: "failed" });
      }
      return { status: "dead_lettered", error: String(err) };
    }
  }

  // SINGLE-SESSION-CONFIRM-01: best-effort single-session resolution broadcast. Mirrors
  // handlePackPayment's broadcast discipline — a failure only logs; the client recovers via
  // the channel-endpoint poll on (re)subscribe.
  private async broadcastResolved(
    paymentIntentId: string,
    payload: SingleSessionResolved,
  ): Promise<void> {
    try {
      await this.paymentRepo.broadcastSingleSessionResolved(paymentIntentId, payload);
    } catch (err) {
      log("warn", "Single-session resolution broadcast failed (client will catch up via channel endpoint)", {
        service: "payment", paymentIntentId, status: payload.status, error: String(err),
      });
    }
  }

  // PAYMENTS-AUDIT-01: best-effort insert of the `payments` audit row after a payment
  // succeeds. Best-effort by design — the row backs display/auditing only, so a failure
  // must not break fulfillment (already committed) nor trigger a webhook retry that the
  // idempotency guard would then skip. The insert itself is idempotent on stripe_payment_id.
  private async recordPaymentRow(params: {
    email:           string;
    name:            string;
    stripePaymentId: string;
    amountCents:     number | null | undefined;
    currency:        string | null | undefined;
    checkoutType:    PaymentCheckoutType;
  }): Promise<void> {
    // Legacy checkout.session events may lack amount_total; nothing to record then.
    if (params.amountCents == null) return;
    try {
      const userId = await this.userService.ensureUser(params.email, params.name);
      await this.paymentRepo.recordPayment({
        userId,
        stripePaymentId: params.stripePaymentId,
        amountCents:     params.amountCents,
        currency:        params.currency ?? "eur",
        checkoutType:    params.checkoutType,
        status:          "succeeded",
      });
    } catch (err) {
      log("warn", "Failed to record payment audit row", {
        service: "payment", stripePaymentId: params.stripePaymentId, error: String(err),
      });
    }
  }

  // SINGLE-SESSION-CONFIRM-01: polling status for GET /api/payment-confirmation/channel
  // (single branch). Total + reliable — resolves a missed broadcast and either race
  // direction with the webhook. Order is keyed by PaymentIntent id: confirmed (status-scoped
  // — never stale for a cancelled booking) → slot_taken → failed → pending.
  async getSingleSessionStatus(paymentIntentId: string): Promise<SingleSessionStatusResult> {
    const booking = await this.bookings.findByStripePaymentId(paymentIntentId);
    if (booking) return { status: "confirmed", booking };

    if (await this.paymentRepo.wasRefunded(paymentIntentId)) return { status: "slot_taken" };

    if (await this.paymentRepo.hasFailedBooking(paymentIntentId)) return { status: "failed" };

    return { status: "pending" };
  }

  // REFACTOR-R3-P3-03: state behind GET /api/payment-confirmation/channel. Identity is
  // resolved from PaymentIntent metadata (never from the URL param) — same gate the old
  // /api/sse used — and the single/pack branching that used to live in the route handler
  // now sits here, behind IStripeClient.
  async getConfirmationChannelState(params: {
    paymentIntentId:    string;
    authenticatedEmail: string;
  }): Promise<ConfirmationChannelState> {
    const { paymentIntentId, authenticatedEmail } = params;
    const intent = await this.stripeClient.retrievePaymentIntent(paymentIntentId);

    const email = intent.metadata?.student_email ?? "";
    if (!email) {
      throw Object.assign(new Error("PaymentIntent metadata incomplete"), { statusCode: 400 });
    }
    if (email.toLowerCase().trim() !== authenticatedEmail.toLowerCase().trim()) {
      log("warn", "Unauthorized payment-confirmation channel access attempt", {
        service: "payment", authenticatedEmail, paymentIntentId,
      });
      throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    }

    const channelName = paymentChannelName(paymentIntentId);

    // SINGLE-SESSION-CONFIRM-01: single-session branch — sits AFTER the ownership gate, so
    // no booking/join detail is computed before the 403. Same channelName scheme as packs.
    if ((intent.metadata?.checkout_type ?? "pack") === "single") {
      const { status, booking } = await this.getSingleSessionStatus(paymentIntentId);
      return { channelName, checkoutType: "single", status, ...(booking ? { booking } : {}) };
    }

    // Current state ("backlog" equivalent): if the webhook already landed, return the balance now.
    const metaPackSize = parseInt(intent.metadata?.pack_size ?? "0", 10);
    const confirmed    = await this.credits.hasProcessedPayment(paymentIntentId);
    const balance      = confirmed ? await this.credits.getBalance(email) : null;

    return {
      channelName,
      confirmed,
      credits:  balance?.credits  ?? (confirmed ? metaPackSize : null),
      name:     balance?.name     ?? (intent.metadata?.student_name ?? ""),
      packSize: balance?.packSize ?? metaPackSize,
    };
  }

  private async writeDeadLetter(
    stripeSessionId: string,
    userId:          string,
    startIso:        string,
    error:           unknown,
    studentEmail:    string,
  ): Promise<void> {
    try {
      await this.paymentRepo.recordFailedBooking({
        stripeSessionId, userId, startIso,
        failedAt: new Date().toISOString(),
        error:    String(error),
      });
      log("error", "Dead-letter written for failed booking", { service: "payment", stripeSessionId, userId, startIso });
    } catch (kvErr) {
      log("error", "Failed to write dead-letter record", { service: "payment", stripeSessionId, error: String(kvErr) });
      throw kvErr;
    }

    await sendDeadLetterNotificationEmail({
      studentEmail,
      stripeSessionId,
      userId,
      startIso,
      error: String(error),
    }).catch(() => {});
  }
}
