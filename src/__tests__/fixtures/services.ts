// TEST-01: Fixture builders for integration tests.
// Creates service instances wired with in-memory repositories and fake clients
// so tests exercise real business logic without hitting external systems.
import { CreditService }       from "@/services/CreditService";
import { BookingService }      from "@/services/BookingService";
import { PaymentService }      from "@/services/PaymentService";
import { PricingService }      from "@/services/PricingService";
import { ScheduleService }     from "@/services/ScheduleService";
import { SessionService }      from "@/services/SessionService";
import { SubscriptionService } from "@/services/SubscriptionService";
import { UserService }         from "@/services/UserService";
import { CourseService }       from "@/services/CourseService";
import { AccountService }      from "@/services/AccountService";
import { ContentFeedbackService } from "@/services/ContentFeedbackService";
import { LandingService }      from "@/services/LandingService";
import type { ICreditsRepository }      from "@/domain/repositories/ICreditsRepository";
import type { IAuditRepository }        from "@/domain/repositories/IAuditRepository";
import type { IBookingRepository }      from "@/domain/repositories/IBookingRepository";
import type { ISessionRepository }      from "@/domain/repositories/ISessionRepository";
import type { IPaymentRepository }      from "@/domain/repositories/IPaymentRepository";
import type { ISubscriptionRepository } from "@/domain/repositories/ISubscriptionRepository";
import type { IUserRepository }         from "@/domain/repositories/IUserRepository";
import type { ICourseRepository }       from "@/domain/repositories/ICourseRepository";
import type { ICourseCatalog }          from "@/domain/repositories/ICourseCatalog";
import type { IContentCatalog }         from "@/domain/repositories/IContentCatalog";
import type { IContentFeedbackRepository } from "@/domain/repositories/IContentFeedbackRepository";
import type { ICalendarClient } from "@/infrastructure/google/ICalendarClient";
import type { IZoomClient }     from "@/infrastructure/zoom/ZoomClient";
import type { IEmailClient }    from "@/infrastructure/resend/IEmailClient";
import type { IStripeClient }   from "@/infrastructure/stripe/StripeClient";
import type { WeeklyHours }     from "@/domain/types";

import { InMemoryCreditsRepository }      from "./InMemoryCreditsRepository";
import { InMemoryAuditRepository }        from "./InMemoryAuditRepository";
import { InMemoryBookingRepository }      from "./InMemoryBookingRepository";
import { InMemorySessionRepository }      from "./InMemorySessionRepository";
import { InMemoryPaymentRepository }      from "./InMemoryPaymentRepository";
import { InMemoryUserRepository }         from "./InMemoryUserRepository";
import { InMemoryPricingRepository }      from "./InMemoryPricingRepository";
import { InMemoryScheduleRepository }     from "./InMemoryScheduleRepository";
import { InMemoryConfigCache }            from "./InMemoryConfigCache";
import { InMemoryCourseRepository }       from "./InMemoryCourseRepository";
import { FakeCourseCatalog }              from "./FakeCourseCatalog";
import { InMemoryContentFeedbackRepository } from "./InMemoryContentFeedbackRepository";
import { FakeContentCatalog }             from "./FakeContentCatalog";
import { FakeCalendarClient } from "./FakeCalendarClient";
import { FakeZoomClient }     from "./FakeZoomClient";
import { FakeEmailClient }    from "./FakeEmailClient";
import { FakeStripeClient }   from "./FakeStripeClient";
import { allDaySchedule }     from "./slots";

// ─── CreditService builder ────────────────────────────────────────────────────

export interface CreditServiceDeps {
  credits: ICreditsRepository;
  audit:   IAuditRepository;
}

export function buildTestCreditService(
  overrides: Partial<CreditServiceDeps> = {},
): CreditService {
  return new CreditService(
    overrides.credits ?? new InMemoryCreditsRepository(),
    overrides.audit   ?? new InMemoryAuditRepository(),
  );
}

// ─── BookingService builder ───────────────────────────────────────────────────

export interface BookingServiceDeps {
  bookings:  IBookingRepository;
  credits:   CreditService;
  sessions:  ISessionRepository;
  calendar:  ICalendarClient;
  zoom:      IZoomClient;
  email:     IEmailClient;
  users:     IUserRepository;
  schedule:  ScheduleService;
}

// REFACTOR-R4-P1-01: `weekly` overrides the seeded working hours (see ./slots).
export function buildTestScheduleService(weekly?: WeeklyHours): ScheduleService {
  return new ScheduleService(
    new InMemoryScheduleRepository(weekly),
    new InMemoryAuditRepository(),
    new InMemoryConfigCache(),
  );
}

// REFACTOR-R4-P1-01: createBooking now validates the slot against the working hours.
// The default schedule is open all day so tests that aren't ABOUT working hours only
// need an aligned slot (./slots alignedSlot); pass `schedule` to test the hours.
export function buildTestBookingService(
  overrides: Partial<BookingServiceDeps> = {},
): BookingService {
  return new BookingService(
    overrides.bookings  ?? new InMemoryBookingRepository(),
    overrides.credits   ?? buildTestCreditService(),
    overrides.sessions  ?? new InMemorySessionRepository(),
    overrides.calendar  ?? new FakeCalendarClient(),
    overrides.zoom      ?? new FakeZoomClient(),
    overrides.email     ?? new FakeEmailClient(),
    overrides.users     ?? new InMemoryUserRepository(),
    overrides.schedule  ?? buildTestScheduleService(allDaySchedule()),
  );
}

// ─── PaymentService builder ───────────────────────────────────────────────────

export interface PaymentServiceDeps {
  stripe:      IStripeClient;
  credits:     CreditService;
  bookings:    BookingService;
  paymentRepo: IPaymentRepository;
  userRepo:    IUserRepository;
}

export function buildTestPaymentService(
  overrides: Partial<PaymentServiceDeps> = {},
): { service: PaymentService; stripe: FakeStripeClient; credits: CreditService; calendar: FakeCalendarClient; paymentRepo: InMemoryPaymentRepository } {
  const stripe      = new FakeStripeClient();
  const credits     = overrides.credits  ?? buildTestCreditService();
  const calendar    = new FakeCalendarClient();
  const paymentRepo = overrides.paymentRepo instanceof InMemoryPaymentRepository
    ? overrides.paymentRepo
    : new InMemoryPaymentRepository();
  const userRepo    = overrides.userRepo ?? new InMemoryUserRepository();

  const bookings = overrides.bookings ?? buildTestBookingService({
    credits,
    calendar,
    users: userRepo,
  });

  const pricing = new PricingService(new InMemoryPricingRepository(), new InMemoryAuditRepository());
  const schedule = buildTestScheduleService();

  const service = new PaymentService(
    overrides.stripe ?? stripe,
    credits,
    bookings,
    overrides.paymentRepo ?? paymentRepo,
    new UserService(userRepo),
    pricing,
    schedule,
  );

  return { service, stripe, credits, calendar, paymentRepo };
}

// ─── SubscriptionService builder ─────────────────────────────────────────────

export interface SubscriptionServiceDeps {
  subs:     ISubscriptionRepository;
  userRepo: IUserRepository;
}

export function buildTestSubscriptionService(
  overrides: Partial<SubscriptionServiceDeps> = {},
): { service: SubscriptionService; userRepo: InMemoryUserRepository } {
  const userRepo = (overrides.userRepo as InMemoryUserRepository) ?? new InMemoryUserRepository();

  // Minimal in-memory subscription repo if none provided
  const subs: ISubscriptionRepository = overrides.subs ?? {
    async subscribe() {},
    async isSubscribed() { return false; },
    async unsubscribe() {},
    async listByType() { return []; },
  };

  const service = new SubscriptionService(subs, new UserService(userRepo));
  return { service, userRepo };
}

// ─── CourseService builder ───────────────────────────────────────────────────
// COURSE-P4-01: `catalog` is the published-content half — pass a plain
// `{ courseSlug: lessonSlugs }` map to set the progress denominator.

export interface CourseServiceDeps {
  courses:  ICourseRepository;
  catalog:  ICourseCatalog;
  userRepo: IUserRepository;
}

export function buildTestCourseService(
  overrides: Partial<CourseServiceDeps> = {},
): { service: CourseService; courses: InMemoryCourseRepository; userRepo: InMemoryUserRepository } {
  const courses  = (overrides.courses  as InMemoryCourseRepository) ?? new InMemoryCourseRepository();
  const userRepo = (overrides.userRepo as InMemoryUserRepository)   ?? new InMemoryUserRepository();
  const catalog  = overrides.catalog ?? new FakeCourseCatalog({});

  const service = new CourseService(courses, catalog, new UserService(userRepo));
  return { service, courses, userRepo };
}

// ─── ContentFeedbackService builder ──────────────────────────────────────────
// CONTENT-FEEDBACK-01: `catalog` declares which pages are published (and in which
// locales); anything else is dropped by the service exactly like a draft would be.

export interface ContentFeedbackServiceDeps {
  feedback: IContentFeedbackRepository;
  catalog:  IContentCatalog;
  userRepo: IUserRepository;
  email:    IEmailClient;
}

export function buildTestContentFeedbackService(
  overrides: Partial<ContentFeedbackServiceDeps> = {},
): {
  service:  ContentFeedbackService;
  feedback: InMemoryContentFeedbackRepository;
  userRepo: InMemoryUserRepository;
  email:    FakeEmailClient;
} {
  const feedback = (overrides.feedback as InMemoryContentFeedbackRepository) ?? new InMemoryContentFeedbackRepository();
  const userRepo = (overrides.userRepo as InMemoryUserRepository) ?? new InMemoryUserRepository();
  const email    = (overrides.email as FakeEmailClient) ?? new FakeEmailClient();
  const catalog  = overrides.catalog ?? new FakeContentCatalog([]);

  const service = new ContentFeedbackService(feedback, catalog, new UserService(userRepo), email);
  return { service, feedback, userRepo, email };
}

// ─── SessionService builder ───────────────────────────────────────────────────

export interface SessionServiceDeps {
  sessions:    ISessionRepository;
  zoom:        IZoomClient;
  tutorEmail:  string;
}

export function buildTestSessionService(
  overrides: Partial<SessionServiceDeps> = {},
): SessionService {
  return new SessionService(
    overrides.sessions   ?? new InMemorySessionRepository(),
    overrides.zoom       ?? new FakeZoomClient(),
    overrides.tutorEmail ?? "tutor@test.com",
  );
}

// ─── AccountService builder ───────────────────────────────────────────────────
// ACCOUNT-DELETE-01: returns the collaborators too, so a test can seed bookings
// and credits and then assert on the eligibility gate.

export interface AccountServiceDeps {
  userRepo: IUserRepository;
  bookings: BookingService;
  credits:  CreditService;
  calendar: ICalendarClient;
}

export function buildTestAccountService(
  overrides: Partial<AccountServiceDeps> = {},
): { service: AccountService; userRepo: InMemoryUserRepository; calendar: FakeCalendarClient } {
  const userRepo = (overrides.userRepo as InMemoryUserRepository) ?? new InMemoryUserRepository();
  const calendar = (overrides.calendar as FakeCalendarClient)     ?? new FakeCalendarClient();

  const service = new AccountService(
    userRepo,
    overrides.bookings ?? buildTestBookingService({ users: userRepo, calendar }),
    overrides.credits  ?? buildTestCreditService(),
    calendar,
  );
  return { service, userRepo, calendar };
}

// ─── LandingService builder ───────────────────────────────────────────────────
// LANDING-01: returns the collaborators so a test can book, grant credits or enrol
// and then assert on the destination ladder end to end.

export interface LandingServiceDeps {
  bookings: BookingService;
  credits:  CreditService;
  courses:  CourseService;
}

export function buildTestLandingService(
  overrides: Partial<LandingServiceDeps> = {},
): { service: LandingService; bookings: BookingService; credits: CreditService; courses: CourseService } {
  const credits  = overrides.credits  ?? buildTestCreditService();
  const bookings = overrides.bookings ?? buildTestBookingService({ credits });
  const courses  = overrides.courses  ?? buildTestCourseService().service;

  const service = new LandingService(bookings, credits, courses);
  return { service, bookings, credits, courses };
}
