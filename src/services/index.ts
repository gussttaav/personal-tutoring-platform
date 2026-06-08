// ARCH-12/15/13/14/16: Singleton service instances — import from here in route handlers.
import { CreditService }        from "./CreditService";
import { SessionService }       from "./SessionService";
import { BookingService }       from "./BookingService";
import { PaymentService }       from "./PaymentService";
import { ChatService }          from "./ChatService";
import { SubscriptionService }  from "./SubscriptionService";
import { UserService }          from "./UserService";
import { ReviewService }        from "./ReviewService";
import {
  supabaseCreditsRepository,
  supabaseAuditRepository,
  supabaseBookingRepository,
  supabaseSessionRepository,
  supabasePaymentRepository,
  supabaseSubscriptionRepository,
  supabaseUserRepository,
  supabaseReviewRepository,
  supabaseGoogleReviewPromptRepository,
} from "@/infrastructure/supabase";
import { ZoomClient }      from "@/infrastructure/zoom";
import { CalendarClient }  from "@/infrastructure/google";
import { EmailClient }     from "@/infrastructure/resend";
import { StripeClient }    from "@/infrastructure/stripe/StripeClient";
import { GeminiClient }    from "@/infrastructure/gemini";

export const userService = new UserService(supabaseUserRepository);

export const creditService = new CreditService(supabaseCreditsRepository, supabaseAuditRepository);

const tutorEmail = process.env.TUTOR_EMAIL ?? "";
export const sessionService = new SessionService(supabaseSessionRepository, new ZoomClient(), tutorEmail);

export const bookingService = new BookingService(
  supabaseBookingRepository,
  creditService,
  supabaseSessionRepository,
  new CalendarClient(),
  new ZoomClient(),
  new EmailClient(),
  supabaseUserRepository,
);

export const paymentService = new PaymentService(
  new StripeClient(),
  creditService,
  bookingService,
  supabasePaymentRepository,
  userService,
);

export const chatService = new ChatService(new GeminiClient());

export const subscriptionService = new SubscriptionService(supabaseSubscriptionRepository, userService);

export const reviewService = new ReviewService(
  supabaseReviewRepository,
  supabaseGoogleReviewPromptRepository,
  supabaseBookingRepository,
  userService,
);
