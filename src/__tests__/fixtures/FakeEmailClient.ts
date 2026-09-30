// TEST-01: Fake IEmailClient for integration tests.
// REFACTOR-R4-P3-03: sendPaymentAuditReport.
import type { PaymentAuditReport } from "@/domain/types";
import type {
  IEmailClient,
  ConfirmationEmailParams,
  NewBookingNotificationParams,
  CancellationConfirmationParams,
  CancellationNotificationParams,
  ContentReportNotificationParams,
} from "@/infrastructure/resend/IEmailClient";

type SentEmail =
  | { type: "confirmation";             params: ConfirmationEmailParams }
  | { type: "newBookingNotification";   params: NewBookingNotificationParams }
  | { type: "cancellationConfirmation"; params: CancellationConfirmationParams }
  | { type: "cancellationNotification"; params: CancellationNotificationParams }
  | { type: "contentReportNotification"; params: ContentReportNotificationParams }
  | { type: "paymentAuditReport";       params: PaymentAuditReport };

export class FakeEmailClient implements IEmailClient {
  sent: SentEmail[] = [];

  async sendConfirmation(params: ConfirmationEmailParams): Promise<void> {
    this.sent.push({ type: "confirmation", params });
  }

  async sendNewBookingNotification(params: NewBookingNotificationParams): Promise<void> {
    this.sent.push({ type: "newBookingNotification", params });
  }

  async sendCancellationConfirmation(params: CancellationConfirmationParams): Promise<void> {
    this.sent.push({ type: "cancellationConfirmation", params });
  }

  async sendCancellationNotification(params: CancellationNotificationParams): Promise<void> {
    this.sent.push({ type: "cancellationNotification", params });
  }

  // CONTENT-FEEDBACK-01
  async sendContentReportNotification(params: ContentReportNotificationParams): Promise<void> {
    this.sent.push({ type: "contentReportNotification", params });
  }

  // REFACTOR-R4-P3-03
  async sendPaymentAuditReport(params: PaymentAuditReport): Promise<void> {
    this.sent.push({ type: "paymentAuditReport", params });
  }
}
