// Test helpers for the Supabase DB integration tests.
//
// Migration 0005 added `bookings_no_overlap`, a GiST exclusion constraint that
// rejects overlapping bookings WHERE status = 'confirmed'. The unit jest
// project runs test files in parallel, and the shared CI test database is never
// truncated between unit runs — so two test files seeding a booking at the same
// `Date.now() + 24h` slot (or a stale row left by an earlier failed run) now
// collide on that constraint.
//
// These helpers eliminate both failure modes:
//   - uniqueFutureSlot() hands out non-overlapping far-future slots. A random
//     multi-year base (re-randomised per test file, since jest gives each file
//     a fresh module registry) keeps parallel files apart and dodges stale
//     rows; 2h per-call spacing keeps slots within one file apart.
//   - purgeTestUsers() clears accumulated test rows matching an email pattern.

import { supabase } from "../client";

const DAY_MS  = 86_400_000;
const HOUR_MS = 3_600_000;

// Randomised once per module evaluation (i.e. once per test file in jest).
const FILE_BASE = Date.now() + (366 + Math.floor(Math.random() * 3650)) * DAY_MS;
let seq = 0;

/** A unique, non-overlapping future [start, end) slot (1h long). */
export function uniqueFutureSlot(): { startIso: string; endIso: string } {
  const start = FILE_BASE + seq++ * 2 * HOUR_MS;
  return {
    startIso: new Date(start).toISOString(),
    endIso:   new Date(start + HOUR_MS).toISOString(),
  };
}

/**
 * Deletes all test rows whose owning user's email matches `emailLike`
 * (e.g. "test-booking-%@example.com"), in FK-safe order:
 * session_messages → zoom_sessions → bookings → users. Reviews and
 * google_review_prompts are removed via their ON DELETE CASCADE.
 */
export async function purgeTestUsers(emailLike: string): Promise<void> {
  const { data: users } = await supabase
    .from("users").select("id").like("email", emailLike);
  const userIds = (users ?? []).map((u) => u.id);
  if (userIds.length === 0) return;

  const { data: bookings } = await supabase
    .from("bookings").select("id").in("user_id", userIds);
  const bookingIds = (bookings ?? []).map((b) => b.id);

  if (bookingIds.length > 0) {
    const { data: sessions } = await supabase
      .from("zoom_sessions").select("id").in("booking_id", bookingIds);
    const sessionIds = (sessions ?? []).map((s) => s.id);

    if (sessionIds.length > 0) {
      await supabase.from("session_messages").delete().in("zoom_session_id", sessionIds);
      await supabase.from("zoom_sessions").delete().in("id", sessionIds);
    }
    await supabase.from("bookings").delete().in("id", bookingIds);
  }

  await supabase.from("users").delete().in("id", userIds);
}
