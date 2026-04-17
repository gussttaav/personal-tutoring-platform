/**
 * POST /api/stripe/webhook
 *
 * Applied fixes (cumulative):
 *   Week 2 — ARCH-01: Stripe singleton
 *   Week 2 — ARCH-02: Shared Redis client
 *   Week 2 — ARCH-05: Single-session idempotency key
 *   Week 3 — PAY-01:  Slot re-check before calendar event creation
 *   Week 3 — PAY-03:  Dead-letter pattern for calendar failures
 *   Week 4 — OBS-01:  console.* replaced with structured log() calls
 *   Week 5 — EMB-01:  Added payment_intent.succeeded handler for the
 *                     embedded PaymentElement flow. The legacy
 *                     checkout.session.completed branch is kept for
 *                     backward compatibility during transition.
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { kv } from "@/lib/redis";
import { addOrUpdateStudent } from "@/lib/kv";
import { getAvailableSlots, createCalendarEvent, createCancellationToken } from "@/lib/calendar";
import { sendConfirmationEmail, sendNewBookingNotificationEmail } from "@/lib/email";
import { log } from "@/lib/logger";
import { getSessionDurationWithGrace } from "@/lib/zoom";

const SINGLE_SESSION_IDEMPOTENCY_TTL = 7 * 24 * 60 * 60;
const FAILED_BOOKING_TTL             = 30 * 24 * 60 * 60;

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  label: string
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      log("warn", `${label} attempt failed`, { service: "webhook", attempt, maxAttempts, error: (err as Error).message });
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }
  throw lastError;
}

async function writeDeadLetter(
  stripeSessionId: string,
  email: string,
  startIso: string,
  error: unknown
): Promise<void> {
  try {
    await kv.set(
      `failed:booking:${stripeSessionId}`,
      { stripeSessionId, email, startIso, failedAt: new Date().toISOString(), error: String(error) },
      { ex: FAILED_BOOKING_TTL }
    );
    log("error", "Dead-letter written for failed booking", { service: "webhook", stripeSessionId, email, startIso });
  } catch (kvErr) {
    log("error", "Failed to write dead-letter record", { service: "webhook", stripeSessionId, error: String(kvErr) });
  }

  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (notifyEmail) {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      fetch("https://api.resend.com/emails", {
        method: "POST",
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

// ── Shared logic for pack payment ─────────────────────────────────────────────

async function handlePackPayment(
  metadata: Record<string, string>,
  intentId: string
): Promise<Response | null> {
  const email    = metadata.student_email ?? "";
  const name     = metadata.student_name  ?? "";
  const packSize = parseInt(metadata.pack_size ?? "0", 10);

  if (!email) {
    log("error", "Missing email in pack payment metadata", { service: "webhook", intentId });
    return NextResponse.json({ received: true, warning: "Missing email" });
  }
  if (!packSize) {
    return NextResponse.json({ received: true, warning: "Missing pack_size" });
  }

  try {
    await addOrUpdateStudent(email, name, packSize, `Pack ${packSize} clases`, intentId);
    log("info", "Pack credits written", { service: "webhook", email, packSize });
  } catch (err) {
    log("error", "KV write failed for pack payment", { service: "webhook", email, intentId, error: String(err) });
    return NextResponse.json({ received: false }, { status: 500 });
  }
  return null;
}

// ── Shared logic for single session payment ───────────────────────────────────

async function handleSingleSessionPayment(
  metadata: Record<string, string>,
  intentId: string
): Promise<Response | null> {
  const email           = metadata.student_email ?? "";
  const name            = metadata.student_name  ?? "";
  const startIso        = metadata.start_iso;
  const endIso          = metadata.end_iso;
  const duration        = metadata.session_duration ?? "1h";
  const rescheduleToken = metadata.reschedule_token || null;

  if (!email) {
    log("error", "Missing email in single-session metadata", { service: "webhook", intentId });
    return NextResponse.json({ received: true, warning: "Missing email" });
  }
  if (!startIso || !endIso) {
    log("error", "Missing slot timing in webhook metadata", { service: "webhook", intentId });
    return NextResponse.json({ received: true, warning: "Missing slot timing" });
  }

  // Idempotency check
  const idempotencyKey = `webhook:single:${intentId}`;
  const alreadyDone    = await kv.get(idempotencyKey);
  if (alreadyDone) {
    log("info", "Duplicate single-session webhook skipped", { service: "webhook", intentId });
    return NextResponse.json({ received: true });
  }

  // Slot re-check (PAY-01)
  const slotDate        = startIso.slice(0, 10);
  const durationMinutes = duration === "2h" ? 120 : 60;
  const availableSlots  = await getAvailableSlots(slotDate, durationMinutes).catch(() => null);
  const slotStillFree   = availableSlots?.some(s => s.start === startIso) ?? true;

  if (!slotStillFree) {
    log("warn", "Slot no longer available — refunding", { service: "webhook", email, startIso, intentId });
    try {
      await stripe.refunds.create({ payment_intent: intentId, reason: "duplicate" });
    } catch (refundErr) {
      log("error", "Auto-refund failed", { service: "webhook", intentId, error: String(refundErr) });
    }
    return NextResponse.json({ received: true, warning: "Slot unavailable — refund issued" });
  }

  // Reschedule: delete old event
  if (rescheduleToken) {
    const { verifyCancellationToken, consumeCancellationToken, deleteCalendarEvent } = await import("@/lib/calendar");
    const oldBooking = await verifyCancellationToken(rescheduleToken);
    if (oldBooking) {
      const consumed = await consumeCancellationToken(rescheduleToken);
      if (consumed) {
        try { await deleteCalendarEvent(oldBooking.record.eventId); } catch {}
      }
    }
  }

  const SESSION_LABELS: Record<string, string> = {
    "1h": "Sesión individual · 1 hora",
    "2h": "Sesión individual · 2 horas",
  };
  const sessionLabel = SESSION_LABELS[duration] ?? "Sesión individual";
  const sessionType  = duration === "1h" ? "session1h" : "session2h";

  // Create calendar event with retry + dead-letter (PAY-03)
  let eventId:         string;
  let zoomSessionName: string;
  let cancelToken:     string;

  try {
    const result = await withRetry(
      () => createCalendarEvent({
        summary:      `${sessionLabel} — ${name}`,
        description:  `Alumno: ${name} (${email})\nTipo: ${sessionLabel}\ngustavoai.dev`,
        startIso,
        endIso,
        sessionType,
        studentEmail: email,  // SEC-03
      }),
      3,
      "createCalendarEvent"
    );
    eventId         = result.eventId;
    zoomSessionName = result.zoomSessionName;
    cancelToken = await createCancellationToken({ eventId, email, name, sessionType, startsAt: startIso, endsAt: endIso });
  } catch (err) {
    log("error", "Calendar event creation failed after retries", { service: "webhook", email, startIso, intentId, error: String(err) });
    await writeDeadLetter(intentId, email, startIso, err);
    return NextResponse.json({ received: true, warning: "Calendar creation failed — manual review required" });
  }

  await kv.set(idempotencyKey, { processedAt: new Date().toISOString() }, { ex: SINGLE_SESSION_IDEMPOTENCY_TTL });

  const joinUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/sesion/${cancelToken}`;

  // Schedule auto-termination of the Zoom session after durationWithGrace.
  // TODO: replace with Upstash QStash for production reliability —
  // setTimeout inside a serverless function may not fire if the process
  // is recycled before the timer elapses.
  const delayMs = getSessionDurationWithGrace(sessionType) * 60 * 1_000;
  void (async () => {
    await new Promise(r => setTimeout(r, delayMs));
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/zoom/end`, {
      method:  "POST",
      headers: {
        "X-Internal-Secret": process.env.INTERNAL_SECRET!,
        "Content-Type":      "application/json",
      },
      body: JSON.stringify({ eventId }),
    }).catch((e: unknown) =>
      log("error", "Auto-terminate fetch failed", { service: "webhook", eventId, zoomSessionName, error: String(e) })
    );
  })();

  try {
    await Promise.all([
      sendConfirmationEmail({ to: email, studentName: name, sessionLabel, startIso, endIso, joinUrl, cancelToken, note: null, studentTz: null, sessionType }),
      sendNewBookingNotificationEmail({ studentEmail: email, studentName: name, sessionLabel, startIso, endIso, joinUrl, note: null }),
    ]);
  } catch (emailErr) {
    log("error", "Email send failed after booking", { service: "webhook", email, intentId, error: String(emailErr) });
  }

  log("info", "Single session booked", { service: "webhook", email, startIso });
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    log("error", "Stripe webhook signature verification failed", { service: "webhook", error: String(err) });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── payment_intent.succeeded (embedded PaymentElement flow) ──────────────────
  if (event.type === "payment_intent.succeeded") {
    const intent      = event.data.object as Stripe.PaymentIntent;
    const metadata    = intent.metadata as Record<string, string>;
    const checkoutType = metadata.checkout_type ?? "pack";
    const intentId    = intent.id;

    if (checkoutType === "pack") {
      const earlyReturn = await handlePackPayment(metadata, intentId);
      if (earlyReturn) return earlyReturn;
    }

    if (checkoutType === "single") {
      const earlyReturn = await handleSingleSessionPayment(metadata, intentId);
      if (earlyReturn) return earlyReturn;
    }
  }

  // ── checkout.session.completed (legacy redirect flow — kept for backward compat) ──
  if (event.type === "checkout.session.completed") {
    const session         = event.data.object as Stripe.Checkout.Session;
    const email           = session.metadata?.student_email ?? session.customer_email ?? "";
    const name            = session.metadata?.student_name ?? "";
    const checkoutType    = session.metadata?.checkout_type ?? "pack";
    const stripeSessionId = session.id;

    if (!email) {
      log("error", "Missing email in webhook metadata", { service: "webhook", stripeSessionId });
      return NextResponse.json({ received: true, warning: "Missing email" });
    }

    if (checkoutType === "pack") {
      const packSize = parseInt(session.metadata?.pack_size ?? "0", 10);
      if (!packSize) {
        return NextResponse.json({ received: true, warning: "Missing pack_size" });
      }
      try {
        await addOrUpdateStudent(email, name, packSize, `Pack ${packSize} clases`, stripeSessionId);
        log("info", "Pack credits written", { service: "webhook", email, packSize });
      } catch (err) {
        log("error", "KV write failed for pack payment", { service: "webhook", email, stripeSessionId, error: String(err) });
        return NextResponse.json({ received: false }, { status: 500 });
      }
    }

    if (checkoutType === "single") {
      const startIso        = session.metadata?.start_iso;
      const endIso          = session.metadata?.end_iso;
      const duration        = session.metadata?.session_duration ?? "1h";
      const rescheduleToken = session.metadata?.reschedule_token || null;

      if (!startIso || !endIso) {
        log("error", "Missing slot timing in webhook metadata", { service: "webhook", stripeSessionId });
        return NextResponse.json({ received: true, warning: "Missing slot timing" });
      }

      const idempotencyKey = `webhook:single:${stripeSessionId}`;
      const alreadyDone    = await kv.get(idempotencyKey);
      if (alreadyDone) {
        log("info", "Duplicate single-session webhook skipped", { service: "webhook", stripeSessionId });
        return NextResponse.json({ received: true });
      }

      const slotDate        = startIso.slice(0, 10);
      const durationMinutes = duration === "2h" ? 120 : 60;
      const availableSlots  = await getAvailableSlots(slotDate, durationMinutes).catch(() => null);
      const slotStillFree   = availableSlots?.some(s => s.start === startIso) ?? true;

      if (!slotStillFree) {
        log("warn", "Slot no longer available — refunding", { service: "webhook", email, startIso, stripeSessionId });
        try {
          await stripe.refunds.create({ payment_intent: session.payment_intent as string, reason: "duplicate" });
        } catch (refundErr) {
          log("error", "Auto-refund failed", { service: "webhook", stripeSessionId, error: String(refundErr) });
        }
        return NextResponse.json({ received: true, warning: "Slot unavailable — refund issued" });
      }

      if (rescheduleToken) {
        const { verifyCancellationToken, consumeCancellationToken, deleteCalendarEvent } = await import("@/lib/calendar");
        const oldBooking = await verifyCancellationToken(rescheduleToken);
        if (oldBooking) {
          const consumed = await consumeCancellationToken(rescheduleToken);
          if (consumed) {
            try { await deleteCalendarEvent(oldBooking.record.eventId); } catch {}
          }
        }
      }

      const SESSION_LABELS: Record<string, string> = {
        "1h": "Sesión individual · 1 hora",
        "2h": "Sesión individual · 2 horas",
      };
      const sessionLabel = SESSION_LABELS[duration] ?? "Sesión individual";
      const sessionType  = duration === "1h" ? "session1h" : "session2h";

      let eventId:         string;
      let zoomSessionName: string;
      let cancelToken:     string;

      try {
        const result = await withRetry(
          () => createCalendarEvent({
            summary:      `${sessionLabel} — ${name}`,
            description:  `Alumno: ${name} (${email})\nTipo: ${sessionLabel}\ngustavoai.dev`,
            startIso,
            endIso,
            sessionType,
            studentEmail: email,  // SEC-03
          }),
          3,
          "createCalendarEvent"
        );
        eventId         = result.eventId;
        zoomSessionName = result.zoomSessionName;
        cancelToken = await createCancellationToken({ eventId, email, name, sessionType, startsAt: startIso, endsAt: endIso });
      } catch (err) {
        log("error", "Calendar event creation failed after retries", { service: "webhook", email, startIso, stripeSessionId, error: String(err) });
        await writeDeadLetter(stripeSessionId, email, startIso, err);
        return NextResponse.json({ received: true, warning: "Calendar creation failed — manual review required" });
      }

      await kv.set(idempotencyKey, { processedAt: new Date().toISOString() }, { ex: SINGLE_SESSION_IDEMPOTENCY_TTL });

      const joinUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/sesion/${cancelToken}`;

      const delayMs = getSessionDurationWithGrace(sessionType) * 60 * 1_000;
      void (async () => {
        await new Promise(r => setTimeout(r, delayMs));
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/zoom/end`, {
          method:  "POST",
          headers: {
            "X-Internal-Secret": process.env.INTERNAL_SECRET!,
            "Content-Type":      "application/json",
          },
          body: JSON.stringify({ eventId }),
        }).catch((e: unknown) =>
          log("error", "Auto-terminate fetch failed", { service: "webhook", eventId, zoomSessionName, error: String(e) })
        );
      })();

      try {
        await Promise.all([
          sendConfirmationEmail({ to: email, studentName: name, sessionLabel, startIso, endIso, joinUrl, cancelToken, note: null, studentTz: null, sessionType }),
          sendNewBookingNotificationEmail({ studentEmail: email, studentName: name, sessionLabel, startIso, endIso, joinUrl, note: null }),
        ]);
      } catch (emailErr) {
        log("error", "Email send failed after booking", { service: "webhook", email, stripeSessionId, error: String(emailErr) });
      }

      log("info", "Single session booked", { service: "webhook", email, startIso });
    }
  }

  return NextResponse.json({ received: true });
}
