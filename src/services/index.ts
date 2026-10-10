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
import { ContentFeedbackService } from "./ContentFeedbackService";
import { LandingService }       from "./LandingService";
import { AdminService }         from "./AdminService";
import { BookingPaymentAuditService } from "./BookingPaymentAuditService";
import { BlogAnnouncementService } from "./BlogAnnouncementService";
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
  supabaseContentFeedbackRepository,
  supabaseAdminQueryRepository,
} from "@/infrastructure/supabase";
import { registryCourseCatalog } from "@/lib/courses/catalog";
import { registryContentCatalog } from "@/lib/content/catalog";
import { registryBlogPostCatalog } from "@/lib/blog/post-catalog";
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

// LANDING-01: routes a signed-in visitor to "/" — see LandingService for the ladder.
export const landingService = new LandingService(bookingService, creditService, courseService);

export const reviewService = new ReviewService(
  supabaseReviewRepository,
  supabaseGoogleReviewPromptRepository,
  supabaseBookingRepository,
  userService,
);

// CONTENT-FEEDBACK-01: 👍/👎 + error reports on lessons and posts. The content
// catalog plays the role registryCourseCatalog plays for CourseService — the
// "is this page published" read, injected so the service stays free of I/O.
export const contentFeedbackService = new ContentFeedbackService(
  supabaseContentFeedbackRepository,
  registryContentCatalog,
  userService,
  new EmailClient(),
);

// REFACTOR-R4-P3-02: the admin panel's reads (IAdminQueryRepository) and the manual
// credit adjustment, which goes through CreditService like every other credit write.
export const adminService = new AdminService(
  supabaseAdminQueryRepository,
  creditService,
  pricingService,
  supabaseAuditRepository,
);

// REFACTOR-R4-P3-03: the daily read-only audit of upcoming bookings against their
// payments (GET /api/internal/booking-payment-audit, cron-job.org).
export const bookingPaymentAuditService = new BookingPaymentAuditService(
  supabaseBookingRepository,
  new StripeClient(),
  new EmailClient(),
);

// BLOG-15: emails a published post to the blog subscribers who follow its areas
// (POST /api/admin/blog-announce). The post catalog is the blog registry, injected.
export const blogAnnouncementService = new BlogAnnouncementService(
  supabaseSubscriptionRepository,
  supabaseAuditRepository,
  registryBlogPostCatalog,
  new EmailClient(),
);
