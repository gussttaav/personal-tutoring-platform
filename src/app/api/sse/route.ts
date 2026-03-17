/**
 * GET /api/sse
 *
 * Server-Sent Events endpoint.
 * The browser connects here after a successful Stripe payment and waits
 * for the webhook to publish a "credits_ready" event via Vercel KV pub/sub.
 *
 * Flow:
 *   1. Browser opens  GET /api/sse?session_id=cs_xxx
 *   2. Server polls KV for up to MAX_WAIT_MS (30s) with exponential back-off
 *   3. Webhook (POST /api/stripe/webhook) writes credits to KV and publishes
 *      to the channel "credits:{email}"
 *   4. Server detects the record and streams `event: credits_ready` to the browser
 *   5. Browser closes the connection
 *
 * Note: Vercel KV does not expose Redis pub/sub over HTTP, so we use a
 * short-interval server-side poll (KV reads are ~1ms, not a network call
 * like the old client-side polling was). This keeps the client connection
 * count to 1 and removes the /api/credits hammering entirely.
 */

import { NextRequest } from "next/server";
import Stripe from "stripe";
import type { CreditRecord } from "@/lib/kv";
import { Redis } from "@upstash/redis";

const kv = Redis.fromEnv();

// Maximum time to hold the SSE connection open (Vercel max is 25s on hobby,
// use 24s to stay safely under). Upgrade to a longer timeout on Pro.
const MAX_WAIT_MS = 24_000;
const POLL_INTERVAL_MS = 1_500;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export const dynamic = "force-dynamic"; // never cache this route

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId || !sessionId.startsWith("cs_")) {
    return new Response("Missing or invalid session_id", { status: 400 });
  }

  // Resolve the student email from the Stripe session so we know which KV
  // key to watch. We never trust URL params for the email.
  let email: string;
  let name: string;
  let packSize: number;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    email = session.metadata?.student_email ?? session.customer_email ?? "";
    name = session.metadata?.student_name ?? "";
    packSize = parseInt(session.metadata?.pack_size ?? "0", 10);

    if (!email) {
      return new Response("Session metadata incomplete", { status: 400 });
    }
  } catch {
    return new Response("Could not retrieve Stripe session", { status: 500 });
  }

  const kvKey = `credits:${email.toLowerCase().trim()}`;

  // ── Build the SSE stream ──────────────────────────────────────────────────
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
          // matching stripeSessionId (ensures we're not reading stale data from
          // a previous purchase).
          if (record && record.stripeSessionId === sessionId && record.credits > 0) {
            send("credits_ready", {
              credits: record.credits,
              name: record.name ?? name,
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
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Required for Vercel streaming responses
      "X-Accel-Buffering": "no",
    },
  });
}
