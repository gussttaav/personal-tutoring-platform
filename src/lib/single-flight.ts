// BUILD-04: single-flight + bounded retry for the Supabase reads the root
// [locale] layout performs during static prerender.
//
// Why this exists (measured, 2026-08-28 build 5c3e6fe):
//   16:09:31.354  pricing read start   ┐
//   16:09:31.372  pricing read start   │ six identical concurrent
//   16:09:31.382  pricing read start   │ requests inside 36ms
//   16:09:31.384  pricing read start   │
//   16:09:31.386  pricing read start   │
//   16:09:31.390  pricing read start   ┘
//   16:09:32.047  pricing read FAILED  ms:663  PGRST303 "JWT issued at future"
//
// `unstable_cache` does not deduplicate concurrent misses, so prerendering
// stampedes Supabase with one identical query per in-flight page. The
// PGRST303 rejection is per-request and low-probability — sequential probes
// from the same build container passed 8/8 across two builds — but across a
// burst it becomes likely, and Next aborts the whole export on the first
// failure. `ms:663` proves it was a real round trip, not a cached replay.
//
// `singleFlight` collapses the burst to ONE in-flight request that every
// concurrent caller awaits, which is also simply correct: six identical
// queries where one suffices is waste. `withRetry` is a backstop for the
// residual single-request rejection — deliberately secondary, since retrying
// alone previously failed 7/7 during one bad window.
import { log } from "@/lib/logger";

/**
 * Collapses concurrent calls into a single in-flight promise. The promise is
 * released once settled, so a later call re-runs `fn` (this dedupes
 * concurrency; it is not a cache — `unstable_cache` still handles caching).
 */
export function singleFlight<T>(label: string, fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (inFlight) {
      log("info", "Joined in-flight read", { service: "single-flight", label });
      return inFlight;
    }
    inFlight = fn().finally(() => { inFlight = null; });
    return inFlight;
  };
}

/** Bounded retry with exponential backoff; rethrows the last error. */
export async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 4): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const last = attempt === attempts;
      log(last ? "error" : "warn", "Read attempt failed", {
        service: "single-flight", label, attempt, error: (err as Error).message,
      });
      if (last) throw err;
      await new Promise((r) => setTimeout(r, attempt * 400));
    }
  }
  throw new Error(`withRetry(${label}) exhausted`);
}
