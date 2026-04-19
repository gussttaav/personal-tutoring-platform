// ARCH-16: Slot-locking helpers extracted from lib/calendar.ts.
//
// SLOT LOCKING DESIGN:
//
// The race condition: user A selects slot at 10:00, user B selects the same
// slot at 10:00 a few seconds later. Both proceed through Stripe checkout.
// Both webhooks fire and attempt to create calendar events for the same slot.
//
// Fix: before creating a calendar event (in the webhook or /api/book), call
// acquireSlotLock(startIso, durationMinutes). If it returns false, the slot
// is already being processed by another request — abort and refund.
//
// Implementation:
//   - Key:   slot:lock:{startIso}
//   - Value: 1 (arbitrary non-empty value)
//   - NX:    true (set only if Not eXists — atomic compare-and-set)
//   - TTL:   durationMinutes + 5 minute buffer, so locks never get stuck
//
// The NX flag makes the operation atomic at the Redis level — no Lua script
// needed. If the caller crashed mid-booking, the TTL ensures the slot
// becomes available again automatically.
import { kv } from "./client";

function slotLockKey(startIso: string): string {
  return `slot:lock:${new Date(startIso).toISOString()}`;
}

/**
 * Attempts to acquire an exclusive lock for a time slot.
 *
 * @param startIso        ISO 8601 start time of the slot
 * @param durationMinutes Duration of the slot (used to set the TTL)
 * @returns true if the lock was acquired, false if the slot is already locked
 */
export async function acquireSlotLock(
  startIso: string,
  durationMinutes: number,
): Promise<boolean> {
  const ttlSeconds = durationMinutes * 60 + 5 * 60;
  const result = await kv.set(slotLockKey(startIso), 1, { nx: true, ex: ttlSeconds });
  return result === "OK";
}

/**
 * Releases a previously acquired slot lock.
 * Safe to call even if the lock was never acquired or has already expired.
 */
export async function releaseSlotLock(startIso: string): Promise<void> {
  await kv.del(slotLockKey(startIso));
}
