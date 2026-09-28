// TEST-01: Fake IEmailClient for integration tests.
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
  | { type: "contentReportNotification"; params: ContentReportNotificationParams };

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
}
