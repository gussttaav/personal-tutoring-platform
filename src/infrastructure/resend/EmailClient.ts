// ARCH-13: Thin wrapper around lib/email.ts so BookingService can depend on an
// interface rather than a concrete module — enables testing with mocks.
// REFACTOR-R4-P3-03: sendPaymentAuditReport.
import type { PaymentAuditReport } from "@/domain/types";
import * as emailLib from "./email-functions";
import type {
  IEmailClient,
  ConfirmationEmailParams,
  NewBookingNotificationParams,
  CancellationConfirmationParams,
  CancellationNotificationParams,
  ContentReportNotificationParams,
} from "./IEmailClient";

export class EmailClient implements IEmailClient {
  sendConfirmation(params: ConfirmationEmailParams): Promise<void> {
    return emailLib.sendConfirmationEmail(params);
  }

  sendNewBookingNotification(params: NewBookingNotificationParams): Promise<void> {
    return emailLib.sendNewBookingNotificationEmail(params);
  }

  sendCancellationConfirmation(params: CancellationConfirmationParams): Promise<void> {
    return emailLib.sendCancellationConfirmationEmail(params);
  }

  sendCancellationNotification(params: CancellationNotificationParams): Promise<void> {
    return emailLib.sendCancellationNotificationEmail(params);
  }

  // CONTENT-FEEDBACK-01
  sendContentReportNotification(params: ContentReportNotificationParams): Promise<void> {
    return emailLib.sendContentReportNotificationEmail(params);
  }

  // REFACTOR-R4-P3-03
  sendPaymentAuditReport(report: PaymentAuditReport): Promise<void> {
    return emailLib.sendPaymentAuditReportEmail(report);
  }
}
