/**
 * lib/schemas.ts — all domain Zod schemas in one place
 *
 * ARCH-03: BookSchema was defined inside src/app/api/book/route.ts and the
 * checkout schemas inside src/app/api/stripe/checkout/route.ts. Keeping
 * validation schemas inside route handler files has two problems:
 *
 *   1. They cannot be imported by the typed API client (src/lib/api-client.ts)
 *      without creating an import from lib/ → app/, which breaks the
 *      conventional dependency direction.
 *   2. They cannot be reused for client-side validation or in tests without
 *      pulling in Next.js server-only code.
 *
 * Moving them here lets api-client.ts, route handlers, and tests all share
 * the same schema definitions and inferred types.
 */

import { z } from "zod";
import { SUPPORTED_TIMEZONES } from "@/lib/timezones";

// ─── Booking ──────────────────────────────────────────────────────────────────

export const BookSchema = z.object({
  startIso:        z.string().datetime(),
  endIso:          z.string().datetime(),
  sessionType:     z.enum(["free15min", "session1h", "session2h", "pack"]),
  note:            z.string().max(1000).optional(),
  timezone:        z.string().optional(),
  rescheduleToken: z.string().optional(),
});

export type BookInput = z.infer<typeof BookSchema>;

// ─── Stripe checkout ──────────────────────────────────────────────────────────

export const PackCheckoutSchema = z.object({
  type:     z.literal("pack"),
  packSize: z.union([z.literal(5), z.literal(10)]),
});

export const SingleCheckoutSchema = z.object({
  type:            z.literal("single"),
  duration:        z.enum(["1h", "2h"]),
  startIso:        z.string().datetime(),
  endIso:          z.string().datetime(),
  rescheduleToken: z.string().optional(),
});

export const CheckoutSchema = z.discriminatedUnion("type", [
  PackCheckoutSchema,
  SingleCheckoutSchema,
]);

export type PackCheckoutInput    = z.infer<typeof PackCheckoutSchema>;
export type SingleCheckoutInput  = z.infer<typeof SingleCheckoutSchema>;
export type CheckoutInput        = z.infer<typeof CheckoutSchema>;

// ─── Admin ────────────────────────────────────────────────────────────────────

// ADMIN-01: Credit adjustment by admin — requires a reason for audit attribution.
export const AdjustCreditsSchema = z.object({
  action: z.literal("adjust_credits"),
  amount: z.number().int(),
  reason: z.string().min(1).max(500),
});

export type AdjustCreditsInput = z.infer<typeof AdjustCreditsSchema>;

// Admin price update — amount in cents + reason for audit. The pack "original"
// strikethrough is derived (1h price × hours), so it isn't an input here.
export const UpdatePriceSchema = z.object({
  productKey:  z.enum(["session1h", "session2h", "pack5", "pack10"]),
  amountCents: z.number().int().positive(),
  reason:      z.string().min(1).max(500),
});

export const UpdatePricesSchema = z.array(UpdatePriceSchema).min(1).max(4);

export type UpdatePriceInput = z.infer<typeof UpdatePriceSchema>;

// Admin schedule update — working hours per day + min advance notice + timezone.
// weeklyHours is keyed by day-of-week "0".."6" (0=Sun..6=Sat); an empty/absent
// array means a non-working day. The server is the source of truth and re-checks
// that blocks within a day are ordered and non-overlapping (no adjacency either).
const TimeBlockSchema = z
  .object({
    startMinute: z.number().int().min(0).max(1439),
    endMinute:   z.number().int().min(1).max(1440),
  })
  .refine((b) => b.endMinute > b.startMinute, { message: "end must be after start" });

export const UpdateScheduleSchema = z
  .object({
    weeklyHours: z.record(
      z.enum(["0", "1", "2", "3", "4", "5", "6"]),
      z.array(TimeBlockSchema).max(6),
    ),
    timezone:       z.enum(SUPPORTED_TIMEZONES),
    minNoticeHours: z.number().int().min(0).max(168),
    reason:         z.string().min(1).max(500),
  })
  .superRefine((val, ctx) => {
    for (const [dow, blocks] of Object.entries(val.weeklyHours)) {
      if (!blocks || blocks.length < 2) continue;
      const sorted = [...blocks].sort((a, b) => a.startMinute - b.startMinute);
      for (let i = 1; i < sorted.length; i++) {
        // Reject overlapping AND adjacent blocks (touching blocks should be one).
        if (sorted[i]!.startMinute <= sorted[i - 1]!.endMinute) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Overlapping or adjacent blocks for day ${dow}`,
            path: ["weeklyHours", dow],
          });
          break;
        }
      }
    }
  });

export type UpdateScheduleInput = z.infer<typeof UpdateScheduleSchema>;

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const SubscribeSchema = z.object({
  type: z.enum(["courses", "blog"]),
});

export type SubscribeInput = z.infer<typeof SubscribeSchema>;

// ─── Post-class reviews ───────────────────────────────────────────────────────

export const ReviewSchema = z.discriminatedUnion("kind", [
  z.object({
    kind:    z.literal("rating"),
    eventId: z.string().min(1),
    rating:  z.number().int().min(1).max(5),
  }),
  z.object({
    kind:    z.literal("comment"),
    eventId: z.string().min(1),
    comment: z.string().max(1000),
  }),
  z.object({
    kind:   z.literal("google"),
    action: z.enum(["accept", "decline"]),
  }),
]);

export type ReviewInput = z.infer<typeof ReviewSchema>;

// ─── Locale preference ────────────────────────────────────────────────────────

export const LocaleSchema = z.object({
  locale: z.enum(["es", "en"]),
});

export type LocaleInput = z.infer<typeof LocaleSchema>;

// ─── Mobile auth ────────────────────────────────────────────────────────────────

// MOBILE-AUTH-01: native Google Sign-In yields a Google ID token on-device, which
// the app exchanges for a bearer credential at POST /api/auth/mobile.
export const MobileAuthSchema = z.object({
  idToken: z.string().min(1),
});

export type MobileAuthInput = z.infer<typeof MobileAuthSchema>;

// ─── Booking history ──────────────────────────────────────────────────────────

// BOOKING-HISTORY-01: query params for GET /api/my-bookings/history. Unlike every
// other schema here this one models a query string, so `limit` arrives as a string
// and needs coercion. `cursor` is the opaque "<startsAt>_<id>" keyset token echoed
// back from the previous page; it is validated for shape in the repository.
export const BookingHistoryQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).optional(),
});

export type BookingHistoryQuery = z.infer<typeof BookingHistoryQuerySchema>;

// ─── Courses ──────────────────────────────────────────────────────────────────
// COURSE-P1-02: validate the git-versioned course manifest + lesson frontmatter at
// BUILD time (see src/lib/courses/registry.ts). Both use `z.strictObject` on
// purpose: a silently-ignored typo'd key (`mintues:` instead of `minutes:`) is
// exactly the failure mode this task exists to prevent, so unknown keys are
// rejected, not dropped. These validate raw YAML into the pure domain types
// `Course`/`Lesson` (src/domain/types.ts).

export const CourseBlockSchema = z.strictObject({
  id:      z.number().int().nonnegative(),
  title:   z.string().min(1),
  summary: z.string().min(1),
});

export const CourseManifestSchema = z.strictObject({
  slug:           z.string().min(1),
  title:          z.string().min(1),
  tagline:        z.string().min(1),
  level:          z.string().min(1),
  estimatedHours: z.number().positive(),
  prerequisites:  z.array(z.string().min(1)),
  blocks:         z.array(CourseBlockSchema).min(1),
});

export type CourseManifestInput = z.infer<typeof CourseManifestSchema>;

// COURSE-P3-01: quiz questions, authored in that same lesson frontmatter. The five
// types are a discriminated union on `type`, so an unknown type — or a `numeric`
// question missing its `tolerance` — is a build failure rather than a question that
// silently never grades correct. `explanation` is required on EVERY member: a
// question with no explanation teaches nothing, and this is where that is enforced.
//
// Cross-field rules (`answer` must name a real option, option ids unique) live in a
// `.superRefine` on the UNION rather than on the members, because
// `z.discriminatedUnion` needs plain objects as its members.

const QuizOptionSchema = z.strictObject({
  id:   z.string().min(1),
  text: z.string().min(1),
});

// Spread into each member below; `hint` is optional everywhere.
const quizQuestionBase = {
  id:          z.string().min(1),
  prompt:      z.string().min(1),
  explanation: z.string().min(1),
  hint:        z.string().min(1).optional(),
};

const SingleQuizQuestionSchema = z.strictObject({
  ...quizQuestionBase,
  type:    z.literal("single"),
  options: z.array(QuizOptionSchema).min(2),
  answer:  z.string().min(1),
});

const MultiQuizQuestionSchema = z.strictObject({
  ...quizQuestionBase,
  type:    z.literal("multi"),
  options: z.array(QuizOptionSchema).min(2),
  answer:  z.array(z.string().min(1)).min(1),
});

const BooleanQuizQuestionSchema = z.strictObject({
  ...quizQuestionBase,
  type:   z.literal("boolean"),
  answer: z.boolean(),
});

const NumericQuizQuestionSchema = z.strictObject({
  ...quizQuestionBase,
  type:      z.literal("numeric"),
  answer:    z.number(),
  // Zero is allowed (an exact integer answer) but must be written explicitly, so
  // the author has decided rather than inherited a default.
  tolerance: z.number().nonnegative(),
  unit:      z.string().min(1).optional(),
});

const PredictOutputQuizQuestionSchema = z.strictObject({
  ...quizQuestionBase,
  type:     z.literal("predict-output"),
  code:     z.string().min(1),
  answer:   z.string().min(1),
  language: z.string().min(1).optional(),
});

export const QuizQuestionSchema = z
  .discriminatedUnion("type", [
    SingleQuizQuestionSchema,
    MultiQuizQuestionSchema,
    BooleanQuizQuestionSchema,
    NumericQuizQuestionSchema,
    PredictOutputQuizQuestionSchema,
  ])
  .superRefine((q, ctx) => {
    if (q.type !== "single" && q.type !== "multi") return;

    const ids = q.options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        message: `duplicate option id in question "${q.id}"`,
        path:    ["options"],
      });
    }

    // An `answer` naming an option that does not exist is the single most likely
    // authoring typo, and it produces a question nobody can ever get right.
    const answers = q.type === "single" ? [q.answer] : q.answer;
    for (const a of answers) {
      if (!ids.includes(a)) {
        ctx.addIssue({
          code:    z.ZodIssueCode.custom,
          message: `answer "${a}" is not among the options of question "${q.id}"`,
          path:    ["answer"],
        });
      }
    }
  });

export type QuizQuestionInput = z.infer<typeof QuizQuestionSchema>;

// COURSE-P3-02: code challenges, authored in the same lesson frontmatter. The
// assertions run in the browser (P2-03's Pyodide worker), so everything the runner
// needs must be here and must be right at BUILD time — a challenge with no tests
// grades every submission as a pass, which is worse than no challenge at all.

const ChallengeTestSchema = z.strictObject({
  name: z.string().min(1),
  code: z.string().min(1),
});

export const CodeChallengeSchema = z.strictObject({
  id:      z.string().min(1),
  prompt:  z.string().min(1),
  // An empty starter is almost always a YAML block-scalar mistake (`starter: |`
  // with nothing under it), and it leaves the student a blank box with no signature.
  starter: z.string().min(1),
  // `.min(1)`: the acceptance criterion. Zero tests = a challenge that cannot fail.
  tests:   z.array(ChallengeTestSchema).min(1).superRefine((tests, ctx) => {
    const seen = new Set<string>();
    for (const [i, test] of tests.entries()) {
      if (seen.has(test.name)) {
        ctx.addIssue({
          code:    z.ZodIssueCode.custom,
          message: `duplicate test name "${test.name}"`,
          path:    [i, "name"],
        });
      }
      seen.add(test.name);
    }
  }),
  // Required: a challenge with no reference solution is unrevealable, and the
  // student who gets stuck at three failures has nowhere to go.
  solution:    z.string().min(1),
  explanation: z.string().min(1),
  packages:    z.array(z.string().min(1)).optional(),
});

export type CodeChallengeInput = z.infer<typeof CodeChallengeSchema>;

export const LessonFrontmatterSchema = z.strictObject({
  slug:    z.string().min(1),
  title:   z.string().min(1),
  block:   z.number().int().nonnegative(),
  order:   z.number().int().nonnegative(),
  minutes: z.number().int().positive(),
  summary: z.string().min(1),
  draft:   z.boolean(),
  hasCode: z.boolean(),
  hasQuiz: z.boolean(),
  // COURSE-P3-01: ids must be unique WITHIN a lesson — `<Quiz id="…" />` resolves
  // against this list, so a duplicate makes the reference ambiguous.
  quiz:    z.array(QuizQuestionSchema).superRefine((questions, ctx) => {
    const seen = new Set<string>();
    for (const [i, q] of questions.entries()) {
      if (seen.has(q.id)) {
        ctx.addIssue({
          code:    z.ZodIssueCode.custom,
          message: `duplicate quiz question id "${q.id}"`,
          path:    [i, "id"],
        });
      }
      seen.add(q.id);
    }
  }),
  // COURSE-P3-02: same rule, same reason — `<CodeChallenge id="…" />` resolves
  // against this list.
  challenges: z.array(CodeChallengeSchema).superRefine((challenges, ctx) => {
    const seen = new Set<string>();
    for (const [i, challenge] of challenges.entries()) {
      if (seen.has(challenge.id)) {
        ctx.addIssue({
          code:    z.ZodIssueCode.custom,
          message: `duplicate challenge id "${challenge.id}"`,
          path:    [i, "id"],
        });
      }
      seen.add(challenge.id);
    }
  }),
});

export type LessonFrontmatterInput = z.infer<typeof LessonFrontmatterSchema>;

// ─── Courses — request payloads ───────────────────────────────────────────────
// COURSE-P4-02: unlike the build-time content schemas above, these validate HTTP
// request bodies, so they use plain `z.object` (an unknown key from an older client
// is stripped, not a hard failure) rather than `z.strictObject`.

/** Cap on the serialised `answer` blob. An attempt records WHAT was answered, never
 *  the student's edited code — 2 KB is roomy for any answer shape and hostile to
 *  anyone trying to use the JSONB column as free storage. */
const MAX_ANSWER_CHARS = 2000;

export const CourseProgressUpdateSchema = z.object({
  courseSlug: z.string().min(1).max(100),
  lessonSlug: z.string().min(1).max(100),
  action:     z.enum(["seen", "completed"]),
});

export type CourseProgressUpdateInput = z.infer<typeof CourseProgressUpdateSchema>;

/** Models a query string, so it is parsed from `searchParams`, not a JSON body. */
export const CourseProgressQuerySchema = z.object({
  courseSlug: z.string().min(1).max(100),
});

export type CourseProgressQuery = z.infer<typeof CourseProgressQuerySchema>;

export const CourseAttemptSchema = z.object({
  courseSlug: z.string().min(1).max(100),
  lessonSlug: z.string().min(1).max(100),
  /** Quiz question id, or a code challenge id — both are lesson-unique (P3 lints). */
  quizId:     z.string().min(1).max(100),
  correct:    z.boolean(),
  // `.optional()` AFTER `.refine()` is load-bearing: `.refine` wraps the schema in
  // ZodEffects, which makes the key REQUIRED even though `unknown` admits undefined.
  // Without it, a client that simply omits `answer` gets a 400.
  answer:     z
    .unknown()
    .refine((value) => JSON.stringify(value ?? null).length <= MAX_ANSWER_CHARS, {
      message: `answer must serialise to at most ${MAX_ANSWER_CHARS} characters`,
    })
    .optional(),
});

export type CourseAttemptInput = z.infer<typeof CourseAttemptSchema>;
