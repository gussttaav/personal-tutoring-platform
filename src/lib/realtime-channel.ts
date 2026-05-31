/**
 * REFACTOR-P3-01: Per-eventId Realtime channel tokens.
 *
 * The channel name encodes the eventId via HMAC-SHA256 with a server-only
 * secret. The resulting channel name acts as an unguessable capability token:
 * the server only emits it to authorized participants (see
 * `/api/chat-session/channel`). Anyone with the channel name can subscribe to
 * the broadcast — there is no enforcement at Realtime level — so the secrecy
 * of the name is the security boundary.
 */
import crypto from "crypto";

const REALTIME_CHANNEL_SECRET = process.env.REALTIME_CHANNEL_SECRET;
if (!REALTIME_CHANNEL_SECRET) {
  throw new Error("REALTIME_CHANNEL_SECRET is not set");
}

export function chatChannelName(eventId: string): string {
  const mac = crypto
    .createHmac("sha256", REALTIME_CHANNEL_SECRET!)
    .update(eventId)
    .digest("hex")
    .slice(0, 32); // 128 bits
  return `chat:${mac}`;
}

// REFACTOR-P3-05: Per-PaymentIntent Realtime channel name. Same HMAC capability
// model as chatChannelName (REFACTOR-P3-01): the server only emits this name to
// the verified owner of the PaymentIntent, so it acts as an unguessable token.
export function paymentChannelName(checkoutId: string): string {
  const mac = crypto
    .createHmac("sha256", REALTIME_CHANNEL_SECRET!)
    .update(checkoutId)
    .digest("hex")
    .slice(0, 32); // 128 bits
  return `pay:${mac}`;
}
