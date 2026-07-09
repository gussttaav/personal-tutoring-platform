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
 * REFACTOR-R3-P1-03: the idempotency gate short-circuits on an existing confirmed
 * booking for the PaymentIntent — so a redelivery after createBooking committed but
 * markProcessed failed heals the marker instead of refunding a fulfilled booking.
 */

import type Stripe from "stripe";
import type { IPaymentRepository, FailedBookingEntry } from "@/domain/repositories/IPaymentRepository";
import type { PackSize, SingleSessionResolved, SingleSessionStatusResult } from "@/domain/types";
import type { IStripeClient } from "@/infrastructure/stripe/StripeClient";
import { getAvailableSlots } from "@/infrastructure/google";
import { log } from "@/lib/logger";
import { PermanentWebhookError } from "@/domain/errors";
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
}

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
    const { amount, currency } = await this.pricing.getAmount(packSize === 5 ? "pack5" : "pack10");
    // REFACTOR-P1-05: 5-min window deduplicates double-clicks; deliberate retry
    // after window gets a fresh PI.
    const idempotencyKey = `pack:${email}:${packSize}:${Math.floor(Date.now() / 300_000)}`;
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
  }): Promise<CheckoutResult> {
    const { email, name, duration, startIso, endIso, rescheduleToken } = params;
    const { amount, currency } = await this.pricing.getAmount(duration === "1h" ? "session1h" : "session2h");
    // REFACTOR-P1-05: startIso in key prevents collision between genuinely
    // different slots for the same user/duration within the same 5-min window.
    const idempotencyKey =
      `single:${email}:${duration}:${startIso}:${Math.floor(Date.now() / 300_000)}`;
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
        await this.handlePackPayment(metadata, intent.id);
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
        });
      }
    }
  }

  // ── Admin dead-letter retry ────────────────────────────────────────────────

  async reprocessFailedBooking(stripeSessionId: string): Promise<{ ok: boolean; error?: string }> {
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
        };
      }
    } catch (err) {
      log("error", "Failed to retrieve Stripe entity for retry", { service: "payment", stripeSessionId, error: String(err) });
      return { ok: false, error: "Failed to retrieve Stripe data" };
    }

    try {
      await this.processSingleSession(input);
      await this.paymentRepo.clearFailedBooking(stripeSessionId);
      log("info", "Dead-letter entry cleared after successful retry", { service: "payment", stripeSessionId });
      return { ok: true };
    } catch (err) {
      log("warn", "Dead-letter retry did not succeed", { service: "payment", stripeSessionId, error: String(err) });
      return { ok: false, error: String(err) };
    }
  }

  async listFailedBookings(): Promise<FailedBookingEntry[]> {
    return this.paymentRepo.listFailedBookings();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async handlePackPayment(
    metadata: Record<string, string>,
    intentId: string,
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

    await this.credits.addCredits({
      email, name, amount: packSize,
      packLabel: `Pack ${packSize} clases`, stripeSessionId: intentId,
    });
    log("info", "Pack credits written", { service: "payment", email, packSize });

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

  private async processSingleSession(input: SingleSessionInput): Promise<void> {
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
      return;
    }

    // REFACTOR-R3-P1-03: createBooking and markProcessed are separate writes. If the
    // booking committed but markProcessed failed, Stripe's redelivery must NOT reach the
    // slot re-check (it would see our own calendar event and refund a fulfilled booking).
    // A confirmed booking for this PI is proof of processing — heal the marker and stop.
    if (paymentIntentId) {
      const existing = await this.bookings.findByStripePaymentId(paymentIntentId);
      if (existing) {
        await this.paymentRepo.markProcessed(idempotencyKey).catch(() => {});
        log("info", "Duplicate single-session webhook skipped (booking already exists)", {
          service: "payment", idempotencyKey,
        });
        return;
      }
    }

    // SINGLE-SESSION-CONFIRM-01: a prior run already refunded this PaymentIntent for a taken
    // slot (the refund path does not markProcessed). Short-circuit so a duplicate webhook
    // never attempts a second refund.
    if (paymentIntentId && await this.paymentRepo.wasRefunded(paymentIntentId)) {
      log("info", "Duplicate single-session webhook skipped (already refunded)", { service: "payment", idempotencyKey });
      return;
    }

    // Slot re-check — refund if slot was taken in the meantime
    const slotDate        = startIso.slice(0, 10);
    const durationMinutes = duration === "2h" ? 120 : 60;
    const scheduleConfig  = await this.schedule.getConfig();
    // REFACTOR-R3-P1-02: fail CLOSED. A freebusy failure is retryable (webhook 500 →
    // Stripe redelivers), never "assume free": the exclusion constraint doesn't cover
    // the tutor's manual calendar blocks.
    const availableSlots  = await getAvailableSlots(slotDate, durationMinutes, scheduleConfig, 30);
    const slotStillFree   = availableSlots.some(s => s.start === startIso);

    if (!slotStillFree) {
      log("warn", "Slot no longer available — refunding", { service: "payment", email, startIso, idempotencyKey });
      await this.stripeClient.createRefund({ ...input.refundTarget, reason: "duplicate" });
      // SINGLE-SESSION-CONFIRM-01: persist the queryable refund record (right after the
      // refund actually issued, so the record only ever means "money returned"), then
      // best-effort broadcast. Persistence precedes the fire-and-forget broadcast.
      if (paymentIntentId) {
        await this.paymentRepo.recordSlotTakenRefund(paymentIntentId);
        await this.broadcastResolved(paymentIntentId, { status: "slot_taken" });
      }
      return;
    }

    const sessionType = duration === "1h" ? "session1h" as const : "session2h" as const;

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
        endIso,
        sessionType,
        rescheduleToken:  rescheduleToken ?? undefined,
        stripePaymentId:  paymentIntentId,
      });
      await this.paymentRepo.markProcessed(idempotencyKey);
      log("info", "Single session booked", { service: "payment", email, startIso });

      // SINGLE-SESSION-CONFIRM-01: best-effort confirmation broadcast (persistence above
      // already committed the booking; polling catches up if this is missed).
      if (paymentIntentId) {
        await this.broadcastResolved(paymentIntentId, {
          status:      "confirmed",
          eventId:     booking.eventId,
          startIso,
          endIso,
          sessionType,
          joinToken:   booking.joinToken,
          emailFailed: booking.emailFailed,
        });
      }
    } catch (err) {
      log("error", "Booking failed after payment — writing dead-letter", { service: "payment", email, startIso, idempotencyKey, error: String(err) });
      await this.writeDeadLetter(idempotencyKey, userId, startIso, err, email);
      // SINGLE-SESSION-CONFIRM-01: tell a subscribed client to leave "confirmando pago"
      // (manual recovery handles the rest — polling is the source of truth).
      if (paymentIntentId) {
        await this.broadcastResolved(paymentIntentId, { status: "failed" });
      }
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
