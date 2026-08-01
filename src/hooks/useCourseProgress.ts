/*
 * COURSE-P4-02 — client-side course progress.
 *
 * Lesson pages are statically generated and readable signed-out, so progress cannot
 * be resolved on the server: it is fetched here, after hydration. That is the whole
 * reason this hook exists rather than a prop from the page.
 *
 * How the hook learns whether progress is tracked at all: the API answers a
 * signed-out request with `204 No Content`, so an empty body means "not signed in,
 * don't render progress UI" — no `useSession()`, one round trip, and nothing red in
 * an anonymous reader's console.
 *
 * Plain fetch rather than `@/lib/api-client`, whose `request<T>` calls `res.json()`
 * unconditionally and would throw on exactly that 204.
 *
 * Every failure is swallowed. Progress is a convenience; the lesson is the product,
 * so a failed write must never surface an error, block reading, or retry in a loop.
 * (`console.warn` rather than `log()` from `@/lib/logger`: that module reads
 * AsyncLocalStorage and is server-only. Same choice as `SessionSettings.tsx`.)
 *
 * All state transitions live in the pure `course-progress-state` module, which is
 * where they are unit-tested — this file is the glue: fetch, effects, refs.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CourseProgressDetail,
  ExerciseAttemptHistory,
  LessonProgressDetail,
} from "@/domain/types";
import {
  derive,
  snapshotFromResponse,
  withCompleted,
  withoutCompleted,
  LOADING_SNAPSHOT,
  UNTRACKED_SNAPSHOT,
  type ProgressSnapshot,
} from "./course-progress-state";

export interface CourseProgress {
  /** True once we know the reader is signed in and progress is being recorded. */
  tracking:           boolean;
  loading:            boolean;
  totalLessons:       number;
  completedLessons:   number;
  /** 0–100, rounded. */
  percentComplete:    number;
  completed:          ReadonlySet<string>;
  lastSeenLessonSlug: string | null;
  /** COURSE-P4-04: the current lesson's exercise history, by quiz/challenge id.
   *  Empty while loading, when untracked, and on the landing page (no lesson). */
  exercises:          ReadonlyMap<string, ExerciseAttemptHistory>;
  /** Optimistic: ticks immediately, reverts if the write fails. */
  markCompleted:      (lessonSlug: string) => void;
}

interface Options {
  courseSlug: string;
  /** Present in the reader; omitted on the landing page, which records no view. */
  lessonSlug?: string;
}

const warn = (what: string, err: unknown) =>
  console.warn(`[useCourseProgress] ${what} failed:`, err);

function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

export function useCourseProgress({ courseSlug, lessonSlug }: Options): CourseProgress {
  const [snapshot, setSnapshot] = useState<ProgressSnapshot>(LOADING_SNAPSHOT);

  // One `seen` write per lesson, not per render. A ref (not state) because React
  // Strict Mode mounts twice in dev and a ref survives that — the same guard
  // `useUserSession` uses for its once-per-email credit fetch.
  const seenKey  = lessonSlug ? `${courseSlug}/${lessonSlug}` : null;
  const seenSent = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Fired together, not chained: the read and the view-write are independent, and
    // a signed-out reader gets two cheap 204s rather than a waterfall.
    // Naming the lesson widens the response with its exercise history (P4-04) —
    // same request, same round trip.
    const query = new URLSearchParams({ courseSlug });
    if (lessonSlug) query.set("lessonSlug", lessonSlug);

    fetch(`/api/courses/progress?${query}`)
      .then(async (res) => {
        const body =
          res.ok && res.status !== 204
            ? ((await res.json()) as CourseProgressDetail | LessonProgressDetail)
            : null;
        if (!cancelled) setSnapshot(snapshotFromResponse(res.status, body));
      })
      .catch((err) => {
        if (cancelled) return;
        warn("progress fetch", err);
        setSnapshot(UNTRACKED_SNAPSHOT);
      });

    if (seenKey && seenSent.current !== seenKey) {
      seenSent.current = seenKey;
      postJson("/api/courses/progress", { courseSlug, lessonSlug, action: "seen" }).catch((err) =>
        warn("markLessonSeen", err),
      );
    }

    return () => {
      cancelled = true;
    };
  }, [courseSlug, lessonSlug, seenKey]);

  const markCompleted = useCallback(
    (slug: string) => {
      // Optimistic, then reconciled on failure — otherwise the sidebar would keep a
      // tick that a refresh takes away, which is worse than never ticking at all.
      setSnapshot((prev) => withCompleted(prev, slug));

      postJson("/api/courses/progress", { courseSlug, lessonSlug: slug, action: "completed" })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        })
        .catch((err) => {
          warn("markLessonCompleted", err);
          setSnapshot((prev) => withoutCompleted(prev, slug));
        });
    },
    [courseSlug],
  );

  return useMemo(
    () => ({
      ...derive(snapshot),
      totalLessons:       snapshot.totalLessons,
      completed:          snapshot.completed,
      lastSeenLessonSlug: snapshot.lastSeenLessonSlug,
      exercises:          snapshot.exercises,
      markCompleted,
    }),
    [snapshot, markCompleted],
  );
}
