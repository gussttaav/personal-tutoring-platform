// TEST-01: Fixture builders for integration tests.
// Creates service instances wired with in-memory repositories and fake clients
// so tests exercise real business logic without hitting external systems.
import { CreditService }       from "@/services/CreditService";
import { BookingService }      from "@/services/BookingService";
import { PaymentService }      from "@/services/PaymentService";
import { PricingService }      from "@/services/PricingService";
import { SessionService }      from "@/services/SessionService";
import { SubscriptionService } from "@/services/SubscriptionService";
import { UserService }         from "@/services/UserService";
import type { ICreditsRepository }      from "@/domain/repositories/ICreditsRepository";
import type { IAuditRepository }        from "@/domain/repositories/IAuditRepository";
import type { IBookingRepository }      from "@/domain/repositories/IBookingRepository";
import type { ISessionRepository }      from "@/domain/repositories/ISessionRepository";
import type { IPaymentRepository }      from "@/domain/repositories/IPaymentRepository";
import type { ISubscriptionRepository } from "@/domain/repositories/ISubscriptionRepository";
import type { IUserRepository }         from "@/domain/repositories/IUserRepository";
import type { ICalendarClient } from "@/infrastructure/google/ICalendarClient";
import type { IZoomClient }     from "@/infrastructure/zoom/ZoomClient";
import type { IEmailClient }    from "@/infrastructure/resend/IEmailClient";
import type { IStripeClient }   from "@/infrastructure/stripe/StripeClient";

import { InMemoryCreditsRepository }      from "./InMemoryCreditsRepository";
import { InMemoryAuditRepository }        from "./InMemoryAuditRepository";
import { InMemoryBookingRepository }      from "./InMemoryBookingRepository";
import { InMemorySessionRepository }      from "./InMemorySessionRepository";
import { InMemoryPaymentRepository }      from "./InMemoryPaymentRepository";
import { InMemoryUserRepository }         from "./InMemoryUserRepository";
import { InMemoryPricingRepository }      from "./InMemoryPricingRepository";
import { FakeCalendarClient } from "./FakeCalendarClient";
import { FakeZoomClient }     from "./FakeZoomClient";
import { FakeEmailClient }    from "./FakeEmailClient";
import { FakeStripeClient }   from "./FakeStripeClient";

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
}

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

  const service = new PaymentService(
    overrides.stripe ?? stripe,
    credits,
    bookings,
    overrides.paymentRepo ?? paymentRepo,
    new UserService(userRepo),
    pricing,
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
  };

  const service = new SubscriptionService(subs, new UserService(userRepo));
  return { service, userRepo };
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
