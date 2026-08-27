// BUILD-02: bounded retry for the build-time / ISR Supabase reads in the root
// [locale] layout (getDisplayPrices, getScheduleConfig).
//
// Static prerender of every public page runs those loaders through the
// service-role Supabase client. A transient JWT-validation blip on that query
// — PGRST303 "JWT issued at future", seen right after a Supabase API-key
// rotation while clocks resync — aborts the whole Vercel build on the first
// page it hits (BUILD-01 was the same failure, previously worked around by
// forcing dynamic rendering on the admin subtree). Retrying a few times with a
// short backoff rides out that skew while keeping the data CORRECT — unlike a
// silent fallback, a genuinely-broken read still surfaces because the final
// attempt rethrows.
//
// Mirrors the retry idiom in BookingService.sendWithRetry, but returns the
// resolved value instead of a boolean. Because both loaders wrap this in
// `unstable_cache`, the retry cost is paid once per build (later pages reuse
// the cached value), so a generous window is cheap insurance against a much
// costlier failed deploy.
//
// Window sizing: a reproduced PGRST303 blip lasted ~1 minute end-to-end, so a
// 3-second window is not enough. The exponential backoff below (1,2,4,8,8,8s
// between 7 attempts ≈ 39s total) rides out a typical blip while keeping the
// data CORRECT. It cannot make the build immune to a multi-minute Supabase
// outage — the true fix for the recurring skew is on Supabase's side (their
// gateway mints the PostgREST JWT for sb_secret_ keys; when its clock runs
// ahead of the DB node every token reads as "issued at future").
import { log } from "@/lib/logger";

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 8000;

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts = 7,
): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const last = attempt === attempts;
      log(last ? "error" : "warn", "Cached read attempt failed", {
        service: "with-retry", label, attempt, error: (err as Error).message,
      });
      if (last) throw err;
      const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // Unreachable: the loop returns on success or rethrows on the final attempt.
  throw new Error(`withRetry(${label}) exhausted without resolving`);
}
