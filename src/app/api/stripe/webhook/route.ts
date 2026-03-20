import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { addOrUpdateStudent } from "@/lib/kv";
import { createCalendarEvent, createCancellationToken } from "@/lib/calendar";
import {
  sendConfirmationEmail,
  sendNewBookingNotificationEmail,
} from "@/lib/email";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
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
    const stripe = getStripe();
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

    // ── Pack payment ────────────────────────────────────────────────────────
    if (checkoutType === "pack") {
      const packSize = parseInt(session.metadata?.pack_size ?? "0", 10);
      if (!packSize) {
        return NextResponse.json({ received: true, warning: "Missing pack_size" });
      }
      try {
        await addOrUpdateStudent(email, name, packSize, `Pack ${packSize} clases`, stripeSessionId);
        console.info(`[webhook] Pack credits written: ${email} +${packSize}`);
      } catch (err) {
        console.error("[webhook] KV write failed:", err);
        return NextResponse.json({ error: "KV write failed" }, { status: 500 });
      }
    }

    // ── Single session payment ───────────────────────────────────────────────
    if (checkoutType === "single") {
      const startIso = session.metadata?.start_iso;
      const endIso   = session.metadata?.end_iso;
      const duration = session.metadata?.session_duration ?? "1h";

      if (!startIso || !endIso) {
        console.error("[webhook] Missing slot timing in metadata");
        return NextResponse.json({ received: true, warning: "Missing slot timing" });
      }

      const SESSION_LABELS: Record<string, string> = {
        "1h": "Sesión individual · 1 hora",
        "2h": "Sesión individual · 2 horas",
      };
      const sessionLabel = SESSION_LABELS[duration] ?? "Sesión individual";

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
          sessionType: duration === "1h" ? "session1h" : "session2h",
          startsAt:    startIso,
          endsAt:      endIso,
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
            }),
            sendNewBookingNotificationEmail({
              studentEmail: email,
              studentName:  name,
              sessionLabel,
              startIso,
              endIso,
              meetLink,
            }),
          ]);
        } catch (emailErr) {
          // Log but don't return 500 — booking is already created
          console.error("[webhook] Email send failed:", emailErr);
        }

        console.info(`[webhook] Single session booked: ${email} ${startIso}`);
      } catch (err) {
        console.error("[webhook] Calendar event creation failed:", err);
        // Return 500 so Stripe retries — idempotency handled by the calendar API
        return NextResponse.json({ error: "Calendar event creation failed" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
