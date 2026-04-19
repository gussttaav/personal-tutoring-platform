// ARCH-12/15/13/14: Singleton service instances — import from here in route handlers.
import { CreditService }   from "./CreditService";
import { SessionService }  from "./SessionService";
import { BookingService }  from "./BookingService";
import { PaymentService }  from "./PaymentService";
import { creditsRepository, auditRepository, sessionRepository, bookingRepository, paymentRepository } from "@/infrastructure/redis";
import { ZoomClient }      from "@/infrastructure/zoom";
import { CalendarClient }  from "@/infrastructure/google";
import { SchedulerClient } from "@/infrastructure/qstash";
import { EmailClient }     from "@/infrastructure/resend";
import { StripeClient }    from "@/infrastructure/stripe/StripeClient";

export const creditService = new CreditService(creditsRepository, auditRepository);

const tutorEmail = process.env.TUTOR_EMAIL ?? "";
export const sessionService = new SessionService(sessionRepository, new ZoomClient(), tutorEmail);

export const bookingService = new BookingService(
  bookingRepository,
  creditService,
  new CalendarClient(),
  new ZoomClient(),
  new SchedulerClient(),
  new EmailClient(),
);

export const paymentService = new PaymentService(
  new StripeClient(),
  creditService,
  bookingService,
  paymentRepository,
);
