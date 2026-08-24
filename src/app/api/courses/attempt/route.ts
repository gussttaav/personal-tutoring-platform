/**
 * COURSE-P4-02 — quiz and code-challenge attempts.
 *
 *   POST /api/courses/attempt   { courseSlug, lessonSlug, quizId, correct, answer }
 *
 * Append-only: one row per attempt, so "which question does everyone get wrong"
 * stays answerable later. Code challenges report through the same path with their
 * challenge id in `quizId` — the payload is the OUTCOME (passed/total), never the
 * student's edited code, which is a separate design question and out of scope.
 *
 * Same two departures from the house pattern as the sibling progress route, for the
 * same reasons: signed-out is 204 rather than 401, and the limiter is keyed by the
 * authenticated email after the session check. See that file's header.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isValidOrigin } from "@/lib/csrf";
import { CourseAttemptSchema } from "@/lib/schemas";
import { courseService } from "@/services";
import { mapDomainErrorToResponse } from "@/lib/http-errors";
import { courseProgressRatelimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  if (!isValidOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await getSession();
  const email   = session?.user?.email;
  if (!email) return new NextResponse(null, { status: 204 });

  const { success } = await courseProgressRatelimit.limit(email);
  if (!success) return NextResponse.json({ error: "Demasiadas peticiones" }, { status: 429 });

  const body   = await req.json().catch(() => ({}));
  const parsed = CourseAttemptSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const { courseSlug, lessonSlug, quizId, correct, answer } = parsed.data;

  try {
    await courseService.recordQuizAttempt(email, courseSlug, lessonSlug, quizId, correct, answer);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapDomainErrorToResponse(err, { email, courseSlug, lessonSlug, quizId });
  }
}
