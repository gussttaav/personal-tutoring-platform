"use client";

/*
 * COURSE-P4-02 — the reader's one progress boundary.
 *
 * Mounted by `LessonLayout` around the whole subtree, which makes it the single place
 * the lesson page talks to the progress API. It does two jobs:
 *
 *   1. Publishes the `useCourseProgress` state to the client leaves scattered through
 *      the server-rendered tree (sidebar ticks, the mobile counter, mark-complete).
 *      Server components can render client leaves; context resolves at RUNTIME, so
 *      the leaves find this provider even though their elements were created on the
 *      server. Nothing about the page becomes dynamic.
 *
 *   2. COURSE-P4-04: publishes the current lesson's ATTEMPT HISTORY through
 *      `AttemptHistoryContext`, which is what lets a quiz answered last week come
 *      back answered. Same fetch as (1) — the GET carries `lessonSlug` now.
 *
 *   3. Fills the two wiring points P3-01/P3-02 left behind. `QuizAttemptContext` and
 *      `ChallengeAttemptContext` get the SAME handler — `AssessmentResult` is the
 *      union of both payloads, and contravariance makes one
 *      `(r: AssessmentResult) => void` assignable to each — so persistence lives in
 *      one place and neither card file has to be reopened.
 *
 * `onAnswered` must keep a STABLE identity. The cards fire it from an effect keyed on
 * `[state.result, onAnswered]`, so a handler that changed identity when progress
 * loaded would re-fire the effect and record the same attempt twice. That is why the
 * signed-in check reads a ref rather than closing over `tracking`.
 *
 * COURSE-P4-04 (fix) — `onAnswered` now writes BOTH ways: it merges the attempt into the
 * local snapshot and then persists it. It used to only persist, which left `exercises`
 * frozen at whatever the mount-time GET returned, so `LessonComplete` reported "0 de N"
 * to a student who had just solved all N, and only told the truth on a later visit.
 *
 * The local merge cannot re-hydrate the card that produced it: `QuizCard` guards with a
 * `hydrated` ref, and the reducer refuses a `hydrate` once `attempts > 0 || result !==
 * null`. Both hold for a card the student has just answered.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import type { AssessmentResult } from "@/domain/types";
import { useCourseProgress, type CourseProgress } from "@/hooks/useCourseProgress";
import { QuizAttemptContext } from "@/features/courses/quiz/QuizCard";
import { ChallengeAttemptContext } from "@/features/courses/code/CodeChallengeCard";
import { AttemptHistoryContext, type AttemptHistory } from "./attempt-history";

const CourseProgressContext = createContext<CourseProgress | null>(null);

/** `null` outside a provider — every consumer is a leaf that renders nothing then. */
export function useReaderProgress(): CourseProgress | null {
  return useContext(CourseProgressContext);
}

interface CourseProgressProviderProps {
  courseSlug: string;
  lessonSlug: string;
  children:   ReactNode;
}

export default function CourseProgressProvider({
  courseSlug,
  lessonSlug,
  children,
}: CourseProgressProviderProps) {
  const progress = useCourseProgress({ courseSlug, lessonSlug });

  // Destructured, not read off `progress` inside the handler: `progress` is a fresh
  // object on every snapshot change, and `onAnswered` must not be. `recordAttempt` is
  // built with empty deps precisely so this stays stable — see useCourseProgress.
  const { recordAttempt } = progress;

  const trackingRef = useRef(false);
  useEffect(() => {
    trackingRef.current = progress.tracking;
  }, [progress.tracking]);

  const onAnswered = useCallback(
    (result: AssessmentResult) => {
      // Signed-out attempts are simply not recorded. The route would answer 204
      // anyway; skipping the request keeps an anonymous reader's quiz silent.
      if (!trackingRef.current) return;

      // A code challenge reports its OUTCOME, never the student's code — persisting
      // edited code is a separate design question and explicitly out of scope.
      const { quizId, answer } =
        result.type === "code-challenge"
          ? {
              quizId: result.challengeId,
              answer: {
                kind:             "challenge",
                passed:           result.passed,
                total:            result.total,
                attempt:          result.attempt,
                solutionRevealed: result.solutionRevealed,
              },
            }
          : {
              quizId: result.quizId,
              answer: {
                kind:         "quiz",
                questionType: result.type,
                value:        result.answer,
                hintUsed:     result.hintUsed,
                attempt:      result.attempt,
              },
            };

      // COURSE-P4-04 — merge locally FIRST, then persist. Without this the exercise
      // counter at the foot of the lesson reads "0 de 4" for a student who just solved
      // all four: `exercises` came from the GET at mount and nothing wrote to it again.
      //
      // `attemptedAt` is a JS ISO string (`…Z`) while the server returns PostgREST's
      // `…+00:00`. Display-only on both paths — never compared, never signed — so the
      // normalisation rule in CLAUDE.md does not apply here.
      recordAttempt({
        quizId,
        correct:     result.correct,
        answer,
        attemptedAt: new Date().toISOString(),
      });

      fetch("/api/courses/attempt", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ courseSlug, lessonSlug, quizId, correct: result.correct, answer }),
      }).catch((err) => {
        // Silent by design: a lost attempt must never interrupt a student mid-quiz.
        console.warn("[CourseProgressProvider] recordAttempt failed:", err);
      });
    },
    [courseSlug, lessonSlug, recordAttempt],
  );

  // COURSE-P4-04 — the read side of the same wiring. `loading` until the fetch
  // answers, so a card never claims "never attempted" before it knows.
  const history = useMemo<AttemptHistory>(
    () => ({
      status: progress.loading ? "loading" : progress.tracking ? "ready" : "untracked",
      byId:   progress.exercises,
    }),
    [progress.loading, progress.tracking, progress.exercises],
  );

  return (
    <CourseProgressContext.Provider value={progress}>
      <AttemptHistoryContext.Provider value={history}>
        <QuizAttemptContext.Provider value={onAnswered}>
          <ChallengeAttemptContext.Provider value={onAnswered}>
            {children}
          </ChallengeAttemptContext.Provider>
        </QuizAttemptContext.Provider>
      </AttemptHistoryContext.Provider>
    </CourseProgressContext.Provider>
  );
}
