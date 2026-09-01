"use client";

/*
 * COURSE-P9-01 — Lazily fetch and prepare the course search index.
 *
 * Nothing is fetched until the dialog is opened for the first time: the index is ~116 KB
 * brotli and most visitors never search. Once fetched it is cached at MODULE level, so
 * navigating between lessons — which remounts the provider — reuses it, and the network
 * panel shows exactly one request per course per session.
 *
 * The cache stores the PROMISE, not the result, so two components opening at once share
 * one request. A rejected promise is evicted, otherwise a single offline blip would poison
 * search for the rest of the session and the retry button would do nothing.
 *
 * No AbortController here, deliberately — unlike useWeekAvailability.ts, whose per-request
 * controllers are the right call for a rapidly-changing query. This request is one
 * immutable static asset shared by every consumer; aborting it on unmount would cancel a
 * download another mounted component is still waiting on, and re-requesting it on the next
 * open would waste the bytes already transferred. State updates are guarded with the
 * `cancelled` flag instead (the useCourseProgress.ts pattern).
 */

import { useCallback, useEffect, useState } from "react";
import { prepareIndex, type PreparedIndex } from "@/lib/courses/search/rank";
import type { SearchIndex } from "@/lib/courses/search/types";

export type SearchIndexState =
  | { status: "loading" }
  | { status: "ready"; index: PreparedIndex }
  | { status: "error" };

const cache = new Map<string, Promise<PreparedIndex>>();

function loadIndex(courseSlug: string, locale: string, version: string): Promise<PreparedIndex> {
  const key = `${courseSlug}:${locale}:${version}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const pending = fetch(
    `/api/courses/search-index/${encodeURIComponent(courseSlug)}/${encodeURIComponent(locale)}?v=${encodeURIComponent(version)}`,
  )
    .then(async (res) => {
      if (!res.ok) throw new Error(`search index ${courseSlug}/${locale}: HTTP ${res.status}`);
      // Throws SearchIndexVersionError on a shape this build predates — surfaced as the
      // dialog's error state, never as a crash.
      return prepareIndex((await res.json()) as SearchIndex);
    });

  pending.catch(() => cache.delete(key));
  cache.set(key, pending);
  return pending;
}

/**
 * Fetch the index for one course. The dialog is only mounted while it is open, so
 * mounting IS the activation — there is no `active` flag to gate on.
 *
 * Depending on the primitives directly (rather than a derived key held in a ref) is what
 * keeps this free of both `react-hooks/refs` and `react-hooks/exhaustive-deps` escapes —
 * the repo lints the React 19 rules and both were errors in an earlier version.
 */
export function useSearchIndex(
  courseSlug: string,
  version: string,
  locale: string,
): { state: SearchIndexState; retry: () => void } {
  const [state, setState] = useState<SearchIndexState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // No synchronous setState in the effect body — `loading` is the initial state, and
    // `retry` re-enters it from its own event handler.
    loadIndex(courseSlug, locale, version)
      .then((index) => {
        if (!cancelled) setState({ status: "ready", index });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Client-side, so `console` rather than the server-only log() helper.
        console.warn("[useSearchIndex] failed to load search index:", err);
        setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [courseSlug, version, locale, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
