/**
 * GET /api/sse
 *
 * Server-Sent Events endpoint.
 * The browser connects here after a successful embedded payment and waits
 * for the webhook to write the credit record to KV.
 *
 * Flow:
 *   1. Browser opens  GET /api/sse?payment_intent_id=pi_xxx
 *   2. Server verifies the authenticated user owns this PaymentIntent
 *   3. Server polls KV for up to MAX_WAIT_MS (24s) with fixed interval
 *   4. Webhook (POST /api/stripe/webhook) writes credits to KV
 *   5. Server detects the record and streams `event: credits_ready` to browser
 *   6. Browser closes the connection
 *
 * SECURITY FIX (CRIT-03):
 *   Added NextAuth session check + email ownership verification before
 *   serving the stream. Previously, any caller who knew a valid ID
 *   (visible in the browser URL) could discover the student's email address
 *   and credit balance in real time.
 */

import { NextRequest } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import type { CreditRecord } from "@/domain/types";
import { kv } from "@/infrastructure/redis/client";

// Maximum time to hold the SSE connection open (Vercel max is 25s on hobby,
// use 24s to stay safely under). Upgrade to a longer timeout on Pro.
const MAX_WAIT_MS      = 24_000;
const POLL_INTERVAL_MS = 1_500;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export const dynamic = "force-dynamic"; // never cache this route

export async function GET(req: NextRequest) {
  const paymentIntentId = req.nextUrl.searchParams.get("payment_intent_id");

  if (!paymentIntentId || !paymentIntentId.startsWith("pi_")) {
    return new Response("Missing or invalid payment_intent_id", { status: 400 });
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────────
  // Verify the caller is authenticated before touching Stripe or KV.
  const authSession = await auth();
  if (!authSession?.user?.email) {
    return new Response("Authentication required", { status: 401 });
  }

  // ── Resolve PaymentIntent ─────────────────────────────────────────────────────
  // We read email, name, and packSize from PaymentIntent metadata so we never
  // trust URL parameters for identity.
  let email: string;
  let name: string;
  let packSize: number;

  try {
    const stripe  = getStripe();
    const intent  = await stripe.paymentIntents.retrieve(paymentIntentId);

    email    = intent.metadata?.student_email ?? "";
    name     = intent.metadata?.student_name  ?? "";
    packSize = parseInt(intent.metadata?.pack_size ?? "0", 10);

    if (!email) {
      return new Response("PaymentIntent metadata incomplete", { status: 400 });
    }
  } catch {
    return new Response("Could not retrieve PaymentIntent", { status: 500 });
  }

  // ── Ownership check ───────────────────────────────────────────────────────────
  // The authenticated user's email must match the email on the PaymentIntent.
  if (email.toLowerCase() !== authSession.user.email.toLowerCase()) {
    return new Response("Forbidden", { status: 403 });
  }

  const kvKey = `credits:${email.toLowerCase().trim()}`;

  // ── Build the SSE stream ──────────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: Record<string, unknown>) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      // Send a heartbeat immediately so the browser knows the connection is live
      send("connected", { message: "Waiting for payment confirmation" });

      const deadline = Date.now() + MAX_WAIT_MS;

      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

        try {
          const record = await kv.get<CreditRecord>(kvKey);

          // Credits are ready when the webhook has written the record with the
          // matching paymentIntentId (ensures we're not reading stale data from
          // a previous purchase).
          if (record && record.stripeSessionId === paymentIntentId && record.credits > 0) {
            send("credits_ready", {
              credits:  record.credits,
              name:     record.name ?? name,
              packSize: record.packSize ?? packSize,
            });
            controller.close();
            return;
          }
        } catch {
          // KV read failed — keep trying until deadline
        }
      }

      // Deadline reached — tell the browser to fall back to manual refresh
      send("timeout", { message: "Credits not confirmed within timeout" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no", // required for Vercel streaming responses
    },
  });
}
