// ARCH-12/15/13/14/16: Singleton service instances — import from here in route handlers.
// DB-03: When ENABLE_DUAL_WRITE=true, repos fan writes to both stores.
// DB-05: Supabase is now primary; Redis is shadow. Reads come from Supabase.
import { CreditService }   from "./CreditService";
import { SessionService }  from "./SessionService";
import { BookingService }  from "./BookingService";
import { PaymentService }  from "./PaymentService";
import { ChatService }     from "./ChatService";
import {
  creditsRepository  as redisCreditsRepo,
  auditRepository    as redisAuditRepo,
  sessionRepository  as redisSessionRepo,
  bookingRepository  as redisBookingRepo,
  paymentRepository  as redisPaymentRepo,
} from "@/infrastructure/redis";
import {
  supabaseCreditsRepository,
  supabaseAuditRepository,
  supabaseBookingRepository,
  supabaseSessionRepository,
  supabasePaymentRepository,
} from "@/infrastructure/supabase";
import {
  DualCreditsRepository,
  DualAuditRepository,
  DualBookingRepository,
  DualSessionRepository,
  DualPaymentRepository,
} from "@/infrastructure/dual-write";
import { ZoomClient }      from "@/infrastructure/zoom";
import { CalendarClient }  from "@/infrastructure/google";
import { SchedulerClient } from "@/infrastructure/qstash";
import { EmailClient }     from "@/infrastructure/resend";
import { StripeClient }    from "@/infrastructure/stripe/StripeClient";
import { GeminiClient }    from "@/infrastructure/gemini";

const DUAL_WRITE = process.env.ENABLE_DUAL_WRITE === "true";

const creditsRepo  = DUAL_WRITE
  ? new DualCreditsRepository(supabaseCreditsRepository, redisCreditsRepo)
  : redisCreditsRepo;

const auditRepo    = DUAL_WRITE
  ? new DualAuditRepository(supabaseAuditRepository, redisAuditRepo)
  : redisAuditRepo;

const bookingRepo  = DUAL_WRITE
  ? new DualBookingRepository(supabaseBookingRepository, redisBookingRepo)
  : redisBookingRepo;

const sessionRepo  = DUAL_WRITE
  ? new DualSessionRepository(supabaseSessionRepository, redisSessionRepo)
  : redisSessionRepo;

const paymentRepo  = DUAL_WRITE
  ? new DualPaymentRepository(supabasePaymentRepository, redisPaymentRepo)
  : redisPaymentRepo;

export const creditService = new CreditService(creditsRepo, auditRepo);

const tutorEmail = process.env.TUTOR_EMAIL ?? "";
export const sessionService = new SessionService(sessionRepo, new ZoomClient(), tutorEmail);

export const bookingService = new BookingService(
  bookingRepo,
  creditService,
  sessionRepo,
  new CalendarClient(),
  new ZoomClient(),
  new SchedulerClient(),
  new EmailClient(),
);

export const paymentService = new PaymentService(
  new StripeClient(),
  creditService,
  bookingService,
  paymentRepo,
);

export const chatService = new ChatService(new GeminiClient());
