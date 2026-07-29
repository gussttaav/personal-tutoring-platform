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
 *   2. Fills the two wiring points P3-01/P3-02 left behind. `QuizAttemptContext` and
 *      `ChallengeAttemptContext` get the SAME handler — `AssessmentResult` is the
 *      union of both payloads, and contravariance makes one
 *      `(r: AssessmentResult) => void` assignable to each — so persistence lives in
 *      one place and neither card file has to be reopened.
 *
 * `onAnswered` must keep a STABLE identity. The cards fire it from an effect keyed on
 * `[state.result, onAnswered]`, so a handler that changed identity when progress
 * loaded would re-fire the effect and record the same attempt twice. That is why the
 * signed-in check reads a ref rather than closing over `tracking`.
 */

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { AssessmentResult } from "@/domain/types";
import { useCourseProgress, type CourseProgress } from "@/hooks/useCourseProgress";
import { QuizAttemptContext } from "@/features/courses/quiz/QuizCard";
import { ChallengeAttemptContext } from "@/features/courses/code/CodeChallengeCard";

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

      fetch("/api/courses/attempt", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ courseSlug, lessonSlug, quizId, correct: result.correct, answer }),
      }).catch((err) => {
        // Silent by design: a lost attempt must never interrupt a student mid-quiz.
        console.warn("[CourseProgressProvider] recordAttempt failed:", err);
      });
    },
    [courseSlug, lessonSlug],
  );

  return (
    <CourseProgressContext.Provider value={progress}>
      <QuizAttemptContext.Provider value={onAnswered}>
        <ChallengeAttemptContext.Provider value={onAnswered}>
          {children}
        </ChallengeAttemptContext.Provider>
      </QuizAttemptContext.Provider>
    </CourseProgressContext.Provider>
  );
}
