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
 */

import type Stripe from "stripe";
import type { IPaymentRepository, FailedBookingEntry } from "@/domain/repositories/IPaymentRepository";
import type { PackSize } from "@/domain/types";
import type { IStripeClient } from "@/infrastructure/stripe/StripeClient";
import { getAvailableSlots } from "@/lib/calendar";
import { log } from "@/lib/logger";
import { CreditService } from "./CreditService";
import { BookingService } from "./BookingService";

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

// ─── Price ID helpers (pure, no I/O) ─────────────────────────────────────────

function getPackPriceId(packSize: PackSize): string {
  const ids: Record<number, string | undefined> = {
    5:  process.env.STRIPE_PRICE_ID_PACK5,
    10: process.env.STRIPE_PRICE_ID_PACK10,
  };
  const id = ids[packSize];
  if (!id) throw new Error(`No price ID configured for pack size ${packSize}`);
  return id;
}

function getSingleSessionPriceId(duration: "1h" | "2h"): string {
  const ids = {
    "1h": process.env.STRIPE_PRICE_ID_SESSION_1H,
    "2h": process.env.STRIPE_PRICE_ID_SESSION_2H,
  };
  const id = ids[duration];
  if (!id) throw new Error(`No price ID configured for duration ${duration}`);
  return id;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class PaymentService {
  constructor(
    private readonly stripeClient: IStripeClient,
    private readonly credits:      CreditService,
    private readonly bookings:     BookingService,
    private readonly paymentRepo:  IPaymentRepository,
  ) {}

  // ── Checkout ───────────────────────────────────────────────────────────────

  async createPackCheckout(params: {
    email: string; name: string; packSize: PackSize;
  }): Promise<CheckoutResult> {
    const { email, name, packSize } = params;
    const priceId = getPackPriceId(packSize);
    const { amount, currency } = await this.stripeClient.getPriceAmount(priceId);
    const intent = await this.stripeClient.createPaymentIntent({
      amount,
      currency,
      metadata: {
        student_name:  name,
        student_email: email,
        pack_size:     String(packSize),
        checkout_type: "pack",
      },
    });
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
    const priceId = getSingleSessionPriceId(duration);
    const { amount, currency } = await this.stripeClient.getPriceAmount(priceId);
    const intent = await this.stripeClient.createPaymentIntent({
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
    });
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
        return;
      }

      if (checkoutType === "pack") {
        const packSize = parseInt(session.metadata?.pack_size ?? "0", 10);
        if (!packSize) return;
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
      return;
    }
    if (!packSize) {
      log("warn", "Missing pack_size in metadata", { service: "payment", intentId });
      return;
    }

    await this.credits.addCredits({
      email, name, amount: packSize,
      packLabel: `Pack ${packSize} clases`, stripeSessionId: intentId,
    });
    log("info", "Pack credits written", { service: "payment", email, packSize });
  }

  private async processSingleSession(input: SingleSessionInput): Promise<void> {
    const { email, name, startIso, endIso, duration, rescheduleToken, idempotencyKey } = input;

    if (!email) {
      log("error", "Missing email in single-session metadata", { service: "payment", idempotencyKey });
      return;
    }
    if (!startIso || !endIso) {
      log("error", "Missing slot timing in webhook metadata", { service: "payment", idempotencyKey });
      return;
    }

    // Idempotency check
    if (await this.paymentRepo.isProcessed(idempotencyKey)) {
      log("info", "Duplicate single-session webhook skipped", { service: "payment", idempotencyKey });
      return;
    }

    // Slot re-check — refund if slot was taken in the meantime
    const slotDate        = startIso.slice(0, 10);
    const durationMinutes = duration === "2h" ? 120 : 60;
    const availableSlots  = await getAvailableSlots(slotDate, durationMinutes).catch(() => null);
    const slotStillFree   = availableSlots?.some(s => s.start === startIso) ?? true;

    if (!slotStillFree) {
      log("warn", "Slot no longer available — refunding", { service: "payment", email, startIso, idempotencyKey });
      await this.stripeClient.createRefund({ ...input.refundTarget, reason: "duplicate" });
      return;
    }

    const sessionType = duration === "1h" ? "session1h" as const : "session2h" as const;

    try {
      await this.bookings.createBooking({
        email,
        name,
        startIso,
        endIso,
        sessionType,
        rescheduleToken: rescheduleToken ?? undefined,
      });
      await this.paymentRepo.markProcessed(idempotencyKey);
      log("info", "Single session booked", { service: "payment", email, startIso });
    } catch (err) {
      log("error", "Booking failed after payment — writing dead-letter", { service: "payment", email, startIso, idempotencyKey, error: String(err) });
      await this.writeDeadLetter(idempotencyKey, email, startIso, err);
    }
  }

  private async writeDeadLetter(
    stripeSessionId: string,
    email:           string,
    startIso:        string,
    error:           unknown,
  ): Promise<void> {
    try {
      await this.paymentRepo.recordFailedBooking({
        stripeSessionId, email, startIso,
        failedAt: new Date().toISOString(),
        error:    String(error),
      });
      log("error", "Dead-letter written for failed booking", { service: "payment", stripeSessionId, email, startIso });
    } catch (kvErr) {
      log("error", "Failed to write dead-letter record", { service: "payment", stripeSessionId, error: String(kvErr) });
    }

    const notifyEmail = process.env.NOTIFY_EMAIL;
    if (notifyEmail) {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        fetch("https://api.resend.com/emails", {
          method:  "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from:    process.env.RESEND_FROM ?? "onboarding@resend.dev",
            to:      notifyEmail,
            subject: `⚠️ Reserva fallida — acción manual requerida`,
            html: `<p>No se pudo crear el evento de calendario para la reserva <strong>${stripeSessionId}</strong>.</p>
                   <p>Email: ${email} · Slot: ${startIso}</p><p>Error: ${String(error)}</p>
                   <p>El alumno ha pagado. Gestiona el reembolso o crea el evento manualmente.</p>`,
          }),
        }).catch(() => {});
      }
    }
  }
}
