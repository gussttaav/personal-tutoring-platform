// ARCH-10/16: Domain types — shared across services, repository interfaces, and API contracts.
// These live here so the domain layer has no external dependencies.
// ARCH-16: API response types consolidated from src/types/index.ts.

export type PackSize = 5 | 10;

export type SessionType = "free15min" | "session1h" | "session2h" | "pack";

/** Products whose price is stored in the `pricing` table and is admin-editable. */
export type ProductKey = "session1h" | "session2h" | "pack5" | "pack10";

export interface PriceRecord {
  productKey:  ProductKey;
  amountCents: number;
  currency:    string;
  updatedAt:   string;
  updatedBy:   string | null;
}

// ─── Public pricing DTO (consumed by the mobile app via GET /api/pricing) ─────
// Numeric, serializable, no admin metadata (updatedBy/updatedAt). Clients format
// the currency on-device.

export interface PublicSessionPrice {
  productKey:  "session1h" | "session2h";
  amountCents: number;
  currency:    string;
}

export interface PublicPackPrice {
  productKey:          "pack5" | "pack10";
  amountCents:         number;
  currency:            string;
  hours:               number;
  perClassCents:       number;
  // Derived = 1h session price × hours, present only when it beats the pack price.
  originalAmountCents: number | null;
  savingsCents:        number | null;
  savingsPct:          number | null;
}

export interface PublicPricing {
  currency: string;
  sessions: PublicSessionPrice[];
  packs:    PublicPackPrice[];
}

// ─── Payments (audit rows in the `payments` table) ────────────────────────────
// The generated Supabase types widen these to `string`; we narrow to the CHECK
// constraints defined in the migration.

/** Which checkout flow produced a payment: a credit pack or a single session. */
export type PaymentCheckoutType = "pack" | "single";

/** Lifecycle of a payment audit row. */
export type PaymentStatus = "pending" | "succeeded" | "refunded" | "failed";

/** Input for recording a `payments` row after a Stripe payment succeeds. */
export interface RecordPaymentInput {
  userId:          string;
  stripePaymentId: string;
  amountCents:     number;
  currency:        string;
  checkoutType:    PaymentCheckoutType;
  status?:         PaymentStatus;
}

export interface BookingRecord {
  eventId:          string;
  email:            string;
  name:             string;
  sessionType:      SessionType;
  startsAt:         string;
  endsAt:           string;
  used:             boolean;
  packSize?:        number;
  stripePaymentId?: string;
  // BOOKING-PACKLINK-01: the credit pack this booking drew a credit from (pack
  // sessions only). Persisted to bookings.credit_pack_id; the join that surfaces
  // packSize in the my-bookings surfaces depends on it being set.
  creditPackId?:    string;
}

// Lifecycle of a booking row. Every booking is created 'confirmed'; the daily
// session-cleanup cron settles it to 'completed' (student joined the Zoom
// session) or 'no_show' (they didn't). 'cancelled' is set by the cancel flow.
export type BookingStatus = "confirmed" | "completed" | "cancelled" | "no_show";

// BOOKING-HISTORY-01: one past booking, enriched for the history surface.
// `amountCents` is the price actually paid (derived from the payments row, not
// from the admin-editable `pricing` table, so past bookings stay accurate when
// prices change). It is null for free15min and for rows with no payment record.
export interface BookingHistoryEntry {
  id:          string;         // bookings.id — stable display reference
  eventId:     string;         // may be "" when no calendar event was created
  sessionType: SessionType;
  status:      BookingStatus;
  startsAt:    string;
  endsAt:      string;
  packSize?:   number;
  note:        string | null;
  amountCents: number | null;
  currency:    string | null;  // null whenever amountCents is null
  review:      { rating: number; comment: string | null } | null;
}

// Keyset page. `nextCursor` is an opaque "<startsAt>_<id>" token; null on the
// last page. The id is part of the key because bookings can share a startsAt —
// the no-overlap constraint only applies to 'confirmed' rows, so a cancelled
// booking and its replacement legitimately occupy the same slot.
export interface BookingHistoryPage {
  entries:    BookingHistoryEntry[];
  nextCursor: string | null;
}

// SINGLE-SESSION-CONFIRM-01: async-confirmation surface for single-session payments.
// Detail returned for a confirmed single-session booking (polling + broadcast payload).
export interface SingleSessionBookingDetail {
  eventId:     string;
  startIso:    string;
  endIso:      string;
  sessionType: SessionType;
  joinToken:   string;
}

// Terminal/transitional state of a single-session payment, keyed by PaymentIntent id.
export type SingleSessionStatus = "pending" | "confirmed" | "slot_taken" | "failed";

// Realtime broadcast payload (event: "resolved") emitted on the per-PaymentIntent
// channel. Discriminated by `status` so a single client handler is total.
export type SingleSessionResolved =
  | (SingleSessionBookingDetail & { status: "confirmed"; emailFailed: boolean })
  | { status: "slot_taken" }
  | { status: "failed" };

// Polling result for GET /api/payment-confirmation/channel (single-session branch).
// `booking` is present only when status === "confirmed".
export interface SingleSessionStatusResult {
  status:   SingleSessionStatus;
  booking?: SingleSessionBookingDetail;
}

export interface ZoomSession {
  sessionId:        string;
  sessionName:      string;
  sessionPasscode:  string;
  studentEmail:     string;
  startIso:         string;
  durationMinutes:  number;
  sessionType:      SessionType;
  studentJoinedAt?: string | null;
}

export interface AuditEntry {
  action: string;
  ts:     string;
  [key: string]: unknown;
}

export interface TimeSlot {
  start: string;
  end:   string;
  label: string;
}

// ─── Booking schedule (admin-editable) ────────────────────────────────────────
// Replaces the values that used to be hardcoded in src/lib/booking-config.ts.

/** A single working-hours block within a day, in minutes since midnight. */
export interface TimeBlock {
  startMinute: number;
  endMinute:   number;
}

/**
 * Working hours keyed by day-of-week (0=Sun..6=Sat). Each value is an ordered,
 * non-overlapping list of blocks. An empty array means a non-working day.
 */
export type WeeklyHours = Record<number, TimeBlock[]>;

/** The full booking schedule configuration consumed across server + client. */
export interface ScheduleConfig {
  weeklyHours:        WeeklyHours;
  timezone:           string;
  minNoticeHours:     number;
  /** How many weeks ahead bookings are allowed. Static for now (not editable). */
  bookingWindowWeeks: number;
}

// ─── API response types (consolidated from src/types/index.ts) ────────────────

export interface StudentInfo {
  email:   string;
  name:    string;
  credits: number;
}

export interface CreditResult {
  credits:    number;
  name:       string;
  packSize:   PackSize | null;
  expiresAt?: string;
}

export interface ApiError {
  error: string;
}

/**
 * Response from POST /api/book
 *
 * QUAL-03 fix: the previous definition had { ok: true; remaining: number }
 * which did not match what the route actually returns. The route returns
 * eventId, zoomSessionName, zoomPasscode, cancelToken, and emailFailed —
 * remaining is not included (the component does a separate /api/credits
 * fetch for that).
 */
export interface BookResponse {
  ok:              true;
  eventId:         string;
  zoomSessionName: string;
  zoomPasscode:    string;
  cancelToken:     string;
  joinToken:       string;
  emailFailed:     boolean;
}

export interface CreditsResponse {
  credits:     number;
  name:        string;
  packSize:    PackSize | null;
  hasBookings: boolean;
  /** ISO date the soonest-expiring active pack lapses; null when there is no pack. */
  expiresAt:   string | null;
}

export interface CheckoutResponse {
  url: string;
}

export interface PaymentIntentResponse {
  clientSecret:    string;
  paymentIntentId: string;
}

export interface UserSession {
  email:                string;
  name:                 string;
  credits:              number;
  packSize:             PackSize | null;
  creditsConfirmedAt?:  string;
  /** ISO date the soonest-expiring active pack lapses; null when unknown. */
  expiresAt?:           string | null;
}

/**
 * One upcoming booking as returned by GET /api/my-bookings.
 *
 * Lives here rather than in BookingService so client components can import the
 * type without pulling server code into the bundle.
 */
export interface UserBooking {
  eventId:     string;   // Google Calendar event id; lookup key consumed by the mobile app
  token:       string;   // cancel token
  joinToken:   string;
  sessionType: SessionType;
  startsAt:    string;   // ISO 8601
  endsAt:      string;   // ISO 8601
  packSize?:   number;   // only for sessionType "pack"
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export type SubscriptionType = "courses" | "blog";

export interface SubscriptionRecord {
  id:        string;
  email:     string;
  type:      SubscriptionType;
  createdAt: string;
}

/** COURSE-P6-02: a subscriber, resolved for a background send.
 *
 *  Every subscription row has a `users` row behind it — `POST /api/subscribe` requires a
 *  session and `SubscriptionService.subscribe` calls `ensureUser` first — so `email` always
 *  resolves. `locale` is `users.locale`, NOT the NEXT_LOCALE cookie: a send has no request
 *  context, the same rule the Stripe-webhook booking emails follow. It may be NULL for a
 *  user who never triggered `seedLocaleOnLogin`, which the repository defaults to "es". */
export interface SubscriptionRecipient {
  userId: string;
  email:  string;
  locale: "es" | "en";
}

/** COURSE-P6-02b: which of the three things the courses opt-in promises is being announced.
 *
 *  `launch` and `english` happen once per course, ever. `update` happens as often as the
 *  course changes — which is why it is the only one whose idempotency key has to carry a
 *  discriminator (see CourseAnnounceSchema and the announce route). */
export type AnnouncementKind = "launch" | "english" | "update";

// ─── Reviews ──────────────────────────────────────────────────────────────────

/** Decision returned after a rating is captured: whether the post-class flow
 *  should show the Google-review CTA instead of the comment textarea. */
export interface ReviewDecision {
  showGoogleReview: boolean;
}

/** Per-user Google-review prompt gating state (one row per user). */
export interface GoogleReviewPromptState {
  shownCount:              number;
  skippedCount:            number;
  dismissed:               boolean;
  lastShownCompletedCount: number | null;
  acceptedAt:              string | null;
}

// ─── Courses ──────────────────────────────────────────────────────────────────
// COURSE-P1-02: the typed content registry (src/lib/courses/registry.ts) builds
// these from git-versioned MDX + a per-locale YAML manifest at BUILD time. They
// are the metadata half of the load-bearing "prose is never queried; metadata
// always is" split — read by the sidebar, syllabus, sitemap, and a future mobile
// API. Prose (the MDX body) is deliberately NOT modelled here; it is web-only.
// These are PURE types: no Zod, no external imports (see file header). Zod lives
// in src/lib/schemas.ts and validates the raw files into these shapes.

/** A block groups ordered lessons within a course. `id` is locale-invariant, so
 *  English is a purely additive translation of `title`/`summary`. */
export interface CourseBlock {
  id:      number;
  title:   string;
  summary: string;
}

/** The hero's "what you'll have built" box. `label` too, not just `body`: the
 *  student does not always *build* something, and may build more than one thing. */
export interface CourseOutcome {
  label: string;
  body:  string;
}

/** Prerequisites: the one-line framing plus the checklist. `intro` is per-course
 *  because the claim it makes ("this course is mathematically rigorous") is not. */
export interface CoursePrerequisites {
  intro: string;
  items: string[];
}

/** The closing call to action. `body` is per-course because one course says "no
 *  account needed to read" and the next may require a sign-in or subscription. */
export interface CourseCta {
  heading: string;
  body:    string;
}

/** One frequently-asked question. The list is per-course: cost, time commitment
 *  and "what do I install" all differ from one course to the next. */
export interface CourseFaqItem {
  q: string;
  a: string;
}

/** Course-level metadata from `course.<locale>.yml`. `blocks` is ordering +
 *  prose; individual lessons live in the sibling `<locale>/*.mdx` files and are
 *  attached by the registry (not stored in the manifest). `outcome`/`cta`/`faq`
 *  are the landing page's conversion copy — per-course prose, never shared. */
export interface Course {
  slug:           string;
  title:          string;
  tagline:        string;
  level:          string;
  outcome:        CourseOutcome;
  prerequisites:  CoursePrerequisites;
  cta:            CourseCta;
  faq:            CourseFaqItem[];
  blocks:         CourseBlock[];
}

/** One lesson's metadata (frontmatter), never its prose. `slug` is unique within
 *  a course and locale-invariant. `hasCode`/`hasQuiz` are authored, not derived,
 *  so the reader knows what to lazy-load BEFORE parsing the MDX body (P2-03). */
export interface Lesson {
  slug:    string;
  title:   string;
  block:   number;
  order:   number;
  minutes: number;
  summary: string;
  draft:   boolean;
  hasCode: boolean;
  hasQuiz: boolean;
  // Quiz definitions live in frontmatter, validated by QuizQuestionSchema (P3-01).
  quiz:    QuizQuestion[];
  // Code challenges, same idea, validated by CodeChallengeSchema (P3-02). `hasCode`
  // covers these too: a challenge runs Python exactly like a `<PyCell>` does.
  challenges: CodeChallenge[];
  // COURSE-P8-01: "Para profundizar". Empty on a lesson with nothing to recommend —
  // the reader renders nothing at all in that case.
  reading: ReadingItem[];
}

/** COURSE-P8-01 — one further-reading entry, validated by `ReadingItemSchema`. */
export interface ReadingItem {
  kind:    "paper" | "libro" | "blog" | "video" | "interactivo";
  title:   string;
  authors: string;
  /** Absent for a living resource with no meaningful year (a web tool). */
  year?:   string;
  venue:   string;
  /** The course is Spanish; most primary sources are not. Stated per entry. */
  lang:    "es" | "en";
  url:     string;
  /** One line: what the student gets by going there. */
  note:    string;
}

/** A minimal lesson pointer used for prev/next navigation. */
export interface LessonRef {
  slug:  string;
  title: string;
}

// ─── Course quizzes ───────────────────────────────────────────────────────────
// COURSE-P3-01: self-assessment questions authored in lesson frontmatter and
// placed in the prose with `<Quiz id="…" />`. Graded CLIENT-side by the pure
// `gradeQuestion` (src/lib/courses/quiz/grade.ts) for instant feedback — a
// deliberate choice for a free course, not an oversight: see the note in
// docs/courses/phase-3-assessment/01-quiz-engine.md before "fixing" it.
//
// `prompt`, `options[].text`, `explanation` and `hint` may contain LaTeX; they
// are rendered through the same build-time KaTeX path as the prose.

export type QuizQuestionType = "single" | "multi" | "boolean" | "numeric" | "predict-output";

/** One selectable option. `id` is what the author writes in `answer`, and it is
 *  stable: options are never shuffled, so an explanation may say "la opción B". */
export interface QuizOption {
  id:   string;
  text: string;
}

/** Fields every question carries. `explanation` is MANDATORY and shown whether the
 *  answer was right or wrong — in a rigorous course the explanation is the
 *  teaching, the score is not. */
interface QuizQuestionBase {
  id:          string;
  prompt:      string;
  explanation: string;
  hint?:       string;
}

/** Exactly one correct option. */
export interface SingleQuizQuestion extends QuizQuestionBase {
  type:    "single";
  options: QuizOption[];
  answer:  string;
}

/** Several correct options, graded ALL-OR-NOTHING — there is no partial credit,
 *  and the UI says so before submission. */
export interface MultiQuizQuestion extends QuizQuestionBase {
  type:    "multi";
  options: QuizOption[];
  answer:  string[];
}

/** True/false. A 50% guess is worthless without the explanation, which is why the
 *  base type requires one. */
export interface BooleanQuizQuestion extends QuizQuestionBase {
  type:   "boolean";
  answer: boolean;
}

/** A computed number, compared within `tolerance` — never with `===`. Authors write
 *  `0.3`; a student who computes `0.1 + 0.2` must still be marked correct. */
export interface NumericQuizQuestion extends QuizQuestionBase {
  type:      "numeric";
  answer:    number;
  tolerance: number;
  unit?:     string;
}

/** Show code, ask what it prints. `answer` is the expected stdout, compared after
 *  whitespace normalisation (see gradeQuestion) but case-sensitively. */
export interface PredictOutputQuizQuestion extends QuizQuestionBase {
  type:      "predict-output";
  code:      string;
  answer:    string;
  language?: string;
}

export type QuizQuestion =
  | SingleQuizQuestion
  | MultiQuizQuestion
  | BooleanQuizQuestion
  | NumericQuizQuestion
  | PredictOutputQuizQuestion;

/** What the student submitted, shaped by question type: an option id (`single`),
 *  option ids (`multi`), a boolean, a number, or typed stdout (`predict-output`).
 *  `null` is "nothing answered" and always grades incorrect. */
export type QuizAnswer = string | string[] | boolean | number | null;

/** The graded outcome of ONE attempt. Fired at the `onAnswered` callback on every
 *  submission; P4-02 persists it to `quiz_attempts` (append-only, one row per
 *  attempt), which is why `attempt` and `hintUsed` travel with it. */
export interface QuizResult {
  quizId:   string;
  type:     QuizQuestionType;
  correct:  boolean;
  /** The submitted answer, normalised (multi is sorted + deduped). */
  answer:   QuizAnswer;
  /** Whether the optional hint had been revealed when this answer was submitted. */
  hintUsed: boolean;
  /** 1-based: retries are allowed and each one fires its own result. */
  attempt:  number;
}

// ─── Course code challenges ───────────────────────────────────────────────────
// COURSE-P3-02: "implement softmax so these tests pass". Authored in lesson
// frontmatter next to the quiz questions and placed in the prose with
// `<CodeChallenge id="…" />`. The assertions are run in the P2-03 Pyodide worker,
// in the student's own browser — there is no server-side execution, ever.
//
// The tests are hidden from the PAGE, not from the bundle: they travel in the
// lesson's HTML like everything else in frontmatter. That is fine for
// self-assessment and is stated here so it is not mistaken for an oversight.

/** One hidden assertion. `name` is what the student sees in the results list, so it
 *  should describe the property ("suma 1"), not the code. */
export interface ChallengeTest {
  name: string;
  code: string;
}

/** One challenge: starter code the student edits, tests it must satisfy, and a
 *  reference solution unlocked only after success or repeated failure. */
export interface CodeChallenge {
  id:      string;
  prompt:  string;
  /** Pre-filled editor contents — a signature plus `# tu código aquí`. */
  starter: string;
  tests:   ChallengeTest[];
  /** Reference solution, revealed per the rule in features/courses/code/challenge-state.ts. */
  solution:    string;
  explanation: string;
  /** Pyodide packages the challenge needs, e.g. ["numpy"] — same list `<PyCell>` takes. */
  packages?:   string[];
}

/**
 * The outcome of ONE hidden test.
 *   - `fail`    — an `AssertionError`: the code ran but is wrong.
 *   - `error`   — anything else (`NameError`, `TypeError`, …): a different problem
 *                 entirely, and the UI must not present it as a wrong answer.
 *   - `not-run` — no result came back, i.e. the run was killed mid-suite.
 */
export interface TestResult {
  name:   string;
  status: "pass" | "fail" | "error" | "not-run";
  /** Assertion message, or `TypeError: …` for an error. Empty when the test passed. */
  message?:  string;
  /** Full Python traceback, student frames only. Absent for a pass. */
  traceback?: string;
}

/** The graded outcome of ONE run, shaped to sit alongside `QuizResult` so P4-02
 *  persists both through a single path (see `AssessmentResult`). */
export interface ChallengeResult {
  challengeId: string;
  type:        "code-challenge";
  /** Every declared test passed. */
  correct: boolean;
  passed:  number;
  total:   number;
  /** 1-based, like `QuizResult.attempt`. */
  attempt: number;
  /** Whether the reference solution had been revealed when this run was made. */
  solutionRevealed: boolean;
}

/** Everything a lesson can report about a student's work. The two members
 *  discriminate on `type`, so P4-02 wires ONE handler and hands it to both
 *  `QuizAttemptContext` and `ChallengeAttemptContext`. */
export type AssessmentResult = QuizResult | ChallengeResult;

// ─── Course progress ──────────────────────────────────────────────────────────
// COURSE-P4-01: the STATE half of the content/state split. Everything above in
// the course sections is content read from git at build time; everything here is
// per-user state read from Postgres at request time. `courseSlug`/`lessonSlug`
// are plain strings on both sides — there is no `courses` table, so nothing here
// is a foreign key into content.
//
// The join happens in CourseService, not in SQL: the DB supplies the numerator
// (which lessons this user finished), the registry supplies the denominator (how
// many published lessons the course has today).

/** A lesson is `started` the first time it is opened and `completed` once the
 *  reader marks it done. The transition is one-way — see `ICourseRepository`. */
export type LessonStatus = "started" | "completed";

/** One user's enrolment in one course. Created implicitly on first lesson view
 *  (there is no enrol button). `completedAt` is set once every published lesson
 *  is completed, and is never moved afterwards. */
export interface Enrollment {
  courseSlug:  string;
  enrolledAt:  string;
  completedAt: string | null;
}

/** One user's state for one lesson. `lastSeenAt` powers "continuar donde lo
 *  dejaste"; it moves on every view, including views of an already-completed
 *  lesson (which must NOT regress `status`). */
export interface LessonProgress {
  courseSlug:  string;
  lessonSlug:  string;
  status:      LessonStatus;
  completedAt: string | null;
  lastSeenAt:  string;
}

/** One graded quiz answer. The table is append-only: every attempt is a row, so
 *  "which question does everyone get wrong" stays answerable later. */
export interface QuizAttempt {
  courseSlug:  string;
  lessonSlug:  string;
  quizId:      string;
  correct:     boolean;
  /** The submitted answer, shape-dependent per question type. Stored as JSONB. */
  answer:      unknown;
  attemptedAt: string;
}

/** What the UI needs to render a progress bar and a resume link. Computed, never
 *  stored: `totalLessons` comes from the registry (published lessons only), so
 *  publishing a new lesson correctly LOWERS everyone's percentage instead of
 *  leaving a stale denominator behind. */
export interface CourseProgressSummary {
  courseSlug:         string;
  totalLessons:       number;
  completedLessons:   number;
  /** 0–100, rounded. `0` when the course has no published lessons yet. */
  percentComplete:    number;
  /** Most recently viewed published lesson, or `null` before the first view. */
  lastSeenLessonSlug: string | null;
  /** `null` when the user is not enrolled (progress is still reported as zeroes). */
  enrolledAt:         string | null;
  completedAt:        string | null;
}

/** COURSE-P4-02: the summary plus the per-lesson detail the reader needs. The
 *  sidebar ticks individual lessons, which the scalar counts above cannot express;
 *  this rides along on the same two queries rather than costing a second read.
 *  The personal-area panel (P4-03) stays on the scalar `CourseProgressSummary`. */
export interface CourseProgressDetail extends CourseProgressSummary {
  /** Completed lessons that are still published, in reading order. */
  completedLessonSlugs: string[];
}

/** COURSE-P4-04: one exercise's history, aggregated from the append-only rows.
 *  "Exercise" is either a quiz question or a code challenge — both write to
 *  `quiz_attempts.quiz_id`, so one shape serves both cards.
 *
 *  `solved` is sticky (correct on ANY attempt) while `lastCorrect` describes only
 *  the most recent one: a reader who got it right and then re-tried and slipped has
 *  solved it, and the card still shows the answer they actually left behind. */
export interface ExerciseAttemptHistory {
  quizId:   string;
  attempts: number;
  solved:   boolean;
  lastCorrect: boolean;
  /** The stored JSONB payload of the LAST attempt. `unknown` on purpose: it was
   *  written by an older build of the client against a possibly older question, so
   *  it is validated at the client boundary (lib/courses/quiz/restore.ts) and never
   *  trusted straight into a reducer. */
  lastAnswer:      unknown;
  lastAttemptedAt: string;
}

/** COURSE-P4-04: `CourseProgressDetail` plus ONE lesson's exercise history —
 *  returned only when the progress GET carries a `lessonSlug`. Extends rather than
 *  widens, exactly as `CourseProgressDetail` did over `CourseProgressSummary`, so
 *  the P4-03 list callers keep the shape they asked for.
 *
 *  Scoped to a single lesson deliberately: a course-wide attempt read would be a
 *  much larger payload for a reader who is looking at one page. */
export interface LessonProgressDetail extends CourseProgressDetail {
  lessonSlug: string;
  exercises:  ExerciseAttemptHistory[];
}

/** COURSE-P4-03: a `CourseProgressSummary` merged with the registry metadata the
 *  "Mis cursos" panel needs to render — the title and where "continuar" points.
 *  Neither lives in Postgres (see the content/state split above), so the merge
 *  happens server-side in the route and this is what crosses the wire. */
export interface EnrolledCourseView {
  courseSlug:       string;
  title:            string;
  totalLessons:     number;
  completedLessons: number;
  /** 0–100, rounded. */
  percentComplete:  number;
  /** `lastSeenLessonSlug`, else the first published lesson, else `null` — which
   *  means "no published lesson to resume", so link the course landing instead. */
  resumeLessonSlug: string | null;
  completedAt:      string | null;
  /** The locale whose content tree resolved the title. May differ from the
   *  request locale: a course with no English tree still renders (in Spanish)
   *  for an English reader rather than disappearing from the panel. */
  contentLocale:    string;
}
