/**
 * BLOG-15 — the live recipient count of an announcement form.
 *
 * POSTs `{ ...body, countOnly: true }` to the announce route whenever `body` changes (300 ms
 * after the last change, so typing a key does not fire a request per keystroke) and on
 * `refresh()`. A newer request aborts the one in flight, so a slow answer about the previous
 * selection can never overwrite the current one. `body: null` means "nothing to count yet".
 *
 * Count-only requests never render or send (the route and the schema both guarantee it), so
 * this is safe to call as often as the form changes.
 */
"use client";

import { useCallback, useEffect, useState } from "react";

/** The counts both announce routes return, blog-only fields optional. */
export interface RecipientCounts {
  subscribers:     number;
  /** Blog only: the subscribers whose areas match the post. */
  matching?:       number;
  alreadyNotified: number;
  pending:         number;
  wouldSendNow:    number;
  byLocale:        { es: number; en: number };
}

export interface CountState {
  status: "idle" | "loading" | "ready" | "error";
  data:   RecipientCounts | null;
}

const DEBOUNCE_MS = 300;

export function useRecipientCount(
  endpoint: string,
  body:     Record<string, unknown> | null,
): { count: CountState; refresh: () => void } {
  const [count, setCount] = useState<CountState>({ status: "idle", data: null });
  const [nonce, setNonce] = useState(0);

  // A string, so an equal body rebuilt on every render does not re-run the effect.
  const bodyKey = body ? JSON.stringify({ ...body, countOnly: true }) : null;

  useEffect(() => {
    if (!bodyKey) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setCount({ status: "loading", data: null });
      try {
        const res = await fetch(endpoint, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    bodyKey,
          signal:  controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setCount({ status: "ready", data: (await res.json()) as RecipientCounts });
      } catch {
        if (!controller.signal.aborted) setCount({ status: "error", data: null });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [endpoint, bodyKey, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { count, refresh };
}
