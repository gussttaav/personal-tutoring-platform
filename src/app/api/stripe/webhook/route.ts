/**
 * POST /api/stripe/webhook
 *
 * ARCH-01: Replaced local getStripe() with the shared `stripe` singleton
 * from lib/stripe.ts — no more new Stripe(key) on every webhook delivery.
 *
 * ARCH-05 (single-session idempotency): Previously only pack payments had
 * idempotency protection (via stripeSessionId in the CreditRecord). Single-
 * session payments had none — Stripe retrying a webhook after a network
 * error would create a duplicate calendar event and send duplicate emails.
 *
 * Fix: before processing a single-session webhook, check for a
 * `webhook:single:{stripeSessionId}` key in Redis. If it exists, the event
 * has already been processed and we return 200 immediately. On first
 * processing, we write the key with a 7-day TTL (Stripe's maximum retry
 * window is 72 hours, so 7 days is a safe buffer).
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";                  // ARCH-01: singleton
import { kv } from "@/lib/redis";                       // ARCH-02: shared Redis client
import { addOrUpdateStudent } from "@/lib/kv";
import { createCalendarEvent, createCancellationToken } from "@/lib/calendar";
import {
  sendConfirmationEmail,
  sendNewBookingNotificationEmail,
} from "@/lib/email";

// TTL for single-session idempotency keys (7 days in seconds)
const SINGLE_SESSION_IDEMPOTENCY_TTL = 7 * 24 * 60 * 60;

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
    console.error("[webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session       = event.data.object as Stripe.Checkout.Session;
    const email         = session.metadata?.student_email ?? session.customer_email ?? "";
    const name          = session.metadata?.student_name ?? "";
    const checkoutType  = session.metadata?.checkout_type ?? "pack";
    const stripeSessionId = session.id;

    if (!email) {
      console.error("[webhook] Missing email in metadata");
      return NextResponse.json({ received: true, warning: "Missing email" });
    }

    // ── Pack payment ──────────────────────────────────────────────────────
    if (checkoutType === "pack") {
      const packSize = parseInt(session.metadata?.pack_size ?? "0", 10);
      if (!packSize) {
        return NextResponse.json({ received: true, warning: "Missing pack_size" });
      }
      try {
        // addOrUpdateStudent already checks stripeSessionId for idempotency
        await addOrUpdateStudent(email, name, packSize, `Pack ${packSize} clases`, stripeSessionId);
        console.info(`[webhook] Pack credits written: ${email} +${packSize}`);
      } catch (err) {
        console.error("[webhook] KV write failed:", err);
        return NextResponse.json({ received: false }, { status: 500 });
      }
    }

    // ── Single session payment ────────────────────────────────────────────
    if (checkoutType === "single") {
      const startIso        = session.metadata?.start_iso;
      const endIso          = session.metadata?.end_iso;
      const duration        = session.metadata?.session_duration ?? "1h";
      const rescheduleToken = session.metadata?.reschedule_token || null;

      if (!startIso || !endIso) {
        console.error("[webhook] Missing slot timing in metadata");
        return NextResponse.json({ received: true, warning: "Missing slot timing" });
      }

      // ── ARCH-05: Idempotency check for single sessions ──────────────────
      // Stripe can deliver the same webhook multiple times on network errors
      // or retries. Without this check, each delivery would create a
      // duplicate calendar event and send duplicate confirmation emails.
      const idempotencyKey = `webhook:single:${stripeSessionId}`;
      const alreadyDone    = await kv.get(idempotencyKey);
      if (alreadyDone) {
        console.info(`[webhook] Duplicate single-session webhook skipped: ${stripeSessionId}`);
        return NextResponse.json({ received: true });
      }

      // ── Reschedule: delete old event before creating new one ──────────
      if (rescheduleToken) {
        const {
          verifyCancellationToken,
          consumeCancellationToken,
          deleteCalendarEvent,
        } = await import("@/lib/calendar");

        const oldBooking = await verifyCancellationToken(rescheduleToken);
        if (oldBooking) {
          try { await deleteCalendarEvent(oldBooking.record.eventId); } catch {}
          await consumeCancellationToken(rescheduleToken);
        }
      }

      const SESSION_LABELS: Record<string, string> = {
        "1h": "Sesión individual · 1 hora",
        "2h": "Sesión individual · 2 horas",
      };
      const sessionLabel = SESSION_LABELS[duration] ?? "Sesión individual";
      const sessionType  = duration === "1h" ? "session1h" : "session2h";

      try {
        const { eventId, meetLink } = await createCalendarEvent({
          summary:     `${sessionLabel} — ${name}`,
          description: `Alumno: ${name} (${email})\nTipo: ${sessionLabel}\ngustavoai.dev`,
          startIso,
          endIso,
        });

        const cancelToken = await createCancellationToken({
          eventId,
          email,
          name,
          sessionType,
          startsAt: startIso,
          endsAt:   endIso,
        });

        // Mark as processed before sending emails — if emails fail we still
        // don't want to retry the calendar creation on the next webhook delivery
        await kv.set(idempotencyKey, { processedAt: new Date().toISOString() }, {
          ex: SINGLE_SESSION_IDEMPOTENCY_TTL,
        });

        // Send emails — awaited so errors surface in Vercel logs
        try {
          await Promise.all([
            sendConfirmationEmail({
              to:           email,
              studentName:  name,
              sessionLabel,
              startIso,
              endIso,
              meetLink,
              cancelToken,
              note:         null,
              studentTz:    null,
              sessionType,
            }),
            sendNewBookingNotificationEmail({
              studentEmail: email,
              studentName:  name,
              sessionLabel,
              startIso,
              endIso,
              meetLink,
              note:         null,
            }),
          ]);
        } catch (emailErr) {
          // Log but don't return 500 — booking is already created and
          // idempotency key is written, so Stripe won't retry uselessly
          console.error("[webhook] Email send failed:", emailErr);
        }

        console.info(`[webhook] Single session booked: ${email} ${startIso}`);
      } catch (err) {
        console.error("[webhook] Calendar event creation failed:", err);
        // Return 500 so Stripe retries — the idempotency check at the top
        // of this block ensures the retry won't duplicate the booking once
        // the calendar event is successfully created on a later attempt
        return NextResponse.json({ received: false }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
