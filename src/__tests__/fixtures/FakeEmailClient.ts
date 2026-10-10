// TEST-01: Fake IEmailClient for integration tests.
// REFACTOR-R4-P3-03: sendPaymentAuditReport.
// COURSE-ANNOUNCE-01: course announcements, same `failFor` contract.
// BLOG-15: blog post announcements. `failFor` makes the send throw for those addresses, so
// a bulk-send test can prove one bad address does not cost the rest their email.
import type { PaymentAuditReport } from "@/domain/types";
import type {
  IEmailClient,
  ConfirmationEmailParams,
  NewBookingNotificationParams,
  CancellationConfirmationParams,
  CancellationNotificationParams,
  ContentReportNotificationParams,
  BlogPostAnnouncementParams,
  CourseAnnouncementParams,
} from "@/infrastructure/resend/IEmailClient";

type SentEmail =
  | { type: "confirmation";             params: ConfirmationEmailParams }
  | { type: "newBookingNotification";   params: NewBookingNotificationParams }
  | { type: "cancellationConfirmation"; params: CancellationConfirmationParams }
  | { type: "cancellationNotification"; params: CancellationNotificationParams }
  | { type: "contentReportNotification"; params: ContentReportNotificationParams }
  | { type: "paymentAuditReport";       params: PaymentAuditReport }
  | { type: "blogPostAnnouncement";     params: BlogPostAnnouncementParams }
  | { type: "courseAnnouncement";       params: CourseAnnouncementParams };

export class FakeEmailClient implements IEmailClient {
  sent: SentEmail[] = [];
  failFor = new Set<string>();

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

  // BLOG-15
  async renderBlogPostAnnouncement(
    params: Omit<BlogPostAnnouncementParams, "to">,
  ): Promise<{ subject: string; html: string }> {
    return { subject: `[${params.locale}] ${params.postTitle}`, html: `<p>${params.postSummary}</p>` };
  }

  async sendBlogPostAnnouncement(params: BlogPostAnnouncementParams): Promise<void> {
    if (this.failFor.has(params.to)) throw new Error(`send failed for ${params.to}`);
    this.sent.push({ type: "blogPostAnnouncement", params });
  }

  // COURSE-ANNOUNCE-01
  async renderCourseAnnouncement(
    params: Omit<CourseAnnouncementParams, "to">,
  ): Promise<{ subject: string; html: string }> {
    return { subject: `[${params.locale}] ${params.courseTitle}`, html: `<p>${params.kind}</p>` };
  }

  async sendCourseAnnouncement(params: CourseAnnouncementParams): Promise<void> {
    if (this.failFor.has(params.to)) throw new Error(`send failed for ${params.to}`);
    this.sent.push({ type: "courseAnnouncement", params });
  }
}
