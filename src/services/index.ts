// ARCH-12/15/13/14/16: Singleton service instances — import from here in route handlers.
import { CreditService }        from "./CreditService";
import { SessionService }       from "./SessionService";
import { BookingService }       from "./BookingService";
import { PaymentService }       from "./PaymentService";
import { PricingService }       from "./PricingService";
import { ScheduleService }      from "./ScheduleService";
import { ChatService }          from "./ChatService";
import { SubscriptionService }  from "./SubscriptionService";
import { UserService }          from "./UserService";
import { ReviewService }        from "./ReviewService";
import { MobileAuthService }    from "./MobileAuthService";
import { CourseService }        from "./CourseService";
import { AccountService }       from "./AccountService";
import {
  supabaseCreditsRepository,
  supabaseAuditRepository,
  supabaseBookingRepository,
  supabaseSessionRepository,
  supabasePaymentRepository,
  supabaseSubscriptionRepository,
  supabasePricingRepository,
  supabaseScheduleRepository,
  supabaseUserRepository,
  supabaseReviewRepository,
  supabaseCourseRepository,
  supabaseGoogleReviewPromptRepository,
} from "@/infrastructure/supabase";
import { registryCourseCatalog } from "@/lib/courses/catalog";
import { ZoomClient }      from "@/infrastructure/zoom";
import { CalendarClient, GoogleIdTokenVerifier }  from "@/infrastructure/google";
import { EmailClient }     from "@/infrastructure/resend";
import { StripeClient }    from "@/infrastructure/stripe/StripeClient";
import { GeminiClient }    from "@/infrastructure/gemini";
import { redisConfigCache } from "@/infrastructure/redis";

export const userService = new UserService(supabaseUserRepository);

// MOBILE-AUTH-01: Google ID token → app identity exchange for the mobile app.
export const mobileAuthService = new MobileAuthService(new GoogleIdTokenVerifier(), userService);

export const creditService = new CreditService(supabaseCreditsRepository, supabaseAuditRepository);

const tutorEmail = process.env.TUTOR_EMAIL ?? "";
export const sessionService = new SessionService(supabaseSessionRepository, new ZoomClient(), tutorEmail);

// REFACTOR-R3-P3-02: getConfig() reads through the version-keyed Redis config cache.
export const scheduleService = new ScheduleService(
  supabaseScheduleRepository,
  supabaseAuditRepository,
  redisConfigCache,
);

export const bookingService = new BookingService(
  supabaseBookingRepository,
  creditService,
  supabaseSessionRepository,
  new CalendarClient(),
  new ZoomClient(),
  new EmailClient(),
  supabaseUserRepository,
  scheduleService,
);

export const pricingService = new PricingService(supabasePricingRepository, supabaseAuditRepository);

export const paymentService = new PaymentService(
  new StripeClient(),
  creditService,
  bookingService,
  supabasePaymentRepository,
  userService,
  pricingService,
  scheduleService,
);

export const chatService = new ChatService(new GeminiClient());

export const subscriptionService = new SubscriptionService(supabaseSubscriptionRepository, userService);

// COURSE-P4-01: the catalog is the published-content half of course progress —
// the registry read, injected so CourseService stays free of filesystem I/O.
export const courseService = new CourseService(
  supabaseCourseRepository,
  registryCourseCatalog,
  userService,
);

// ACCOUNT-DELETE-01: self-service account deletion. Takes BookingService and
// CreditService (not their repositories) so the eligibility gate reuses exactly the
// upcoming-bookings and credit-balance reads the rest of the app is built on.
export const accountService = new AccountService(
  supabaseUserRepository,
  bookingService,
  creditService,
  new CalendarClient(),
);

export const reviewService = new ReviewService(
  supabaseReviewRepository,
  supabaseGoogleReviewPromptRepository,
  supabaseBookingRepository,
  userService,
);
