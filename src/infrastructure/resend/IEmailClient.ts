// ARCH-13: Email client interface — enables testing BookingService with mocks.
// BLOG-15: the blog post announcement (bulk), render + send.
// COURSE-ANNOUNCE-01: the course announcement (bulk), render + send.
// REFACTOR-R4-P3-03: sendPaymentAuditReport — the booking-payment audit's findings, to the
// tutor (NOTIFY_EMAIL, Spanish).
import type { AnnouncementKind, BlogArea, PaymentAuditReport } from "@/domain/types";

export interface ConfirmationEmailParams {
  to:           string;
  studentName:  string;
  sessionLabel: string;
  startIso:     string;
  endIso:       string;
  joinToken:    string;
  cancelToken:  string;
  note:         string | null;
  studentTz:    string | null;
  sessionType:  string;
  locale:       'es' | 'en';
  /** Cancellation window (hours) shown in the email's cancel policy line. */
  cancelHours:  number;
}

export interface NewBookingNotificationParams {
  studentEmail: string;
  studentName:  string;
  sessionLabel: string;
  startIso:     string;
  endIso:       string;
  joinUrl:      string;
  note:         string | null;
}

export interface CancellationConfirmationParams {
  to:              string;
  studentName:     string;
  sessionLabel:    string;
  startIso:        string;
  creditsRestored: boolean;
  locale:          'es' | 'en';
}

export interface CancellationNotificationParams {
  studentEmail: string;
  studentName:  string;
  sessionLabel: string;
  startIso:     string;
}

// CONTENT-FEEDBACK-01: admin notification for a new "report an error" on a
// lesson or post. Every field is reader-controlled except `pageUrl` (server-derived).
export interface ContentReportNotificationParams {
  reportId:      string;
  contentType:   'lesson' | 'post';
  contentKey:    string;
  locale:        'es' | 'en';
  pageUrl:       string;
  message:       string;
  reporterEmail: string | null;
}

// BLOG-15: one blog subscriber's copy of a new-post announcement. `postTitle` and
// `postSummary` are in the language the post is read in (the reader's, when it exists).
export interface BlogPostAnnouncementParams {
  to:          string;
  locale:      'es' | 'en';
  slug:        string;
  postTitle:   string;
  postSummary: string;
  areas:       BlogArea[];
  postLocales: ('es' | 'en')[];
}

// COURSE-ANNOUNCE-01: one courses subscriber's copy of a course announcement. `whatsNew` is the
// single admin-typed line of an `update`; the other kinds ignore it.
export interface CourseAnnouncementParams {
  to:              string;
  locale:          'es' | 'en';
  kind:            AnnouncementKind;
  courseSlug:      string;
  courseTitle:     string;
  lessonCount:     number;
  firstLessonSlug: string | null;
  whatsNew?:       string;
}

export interface IEmailClient {
  sendConfirmation(params: ConfirmationEmailParams): Promise<void>;
  sendNewBookingNotification(params: NewBookingNotificationParams): Promise<void>;
  sendCancellationConfirmation(params: CancellationConfirmationParams): Promise<void>;
  sendCancellationNotification(params: CancellationNotificationParams): Promise<void>;
  sendContentReportNotification(params: ContentReportNotificationParams): Promise<void>;
  sendPaymentAuditReport(report: PaymentAuditReport): Promise<void>;
  /** BLOG-15: the dry run's sample — rendered, never sent. */
  renderBlogPostAnnouncement(params: Omit<BlogPostAnnouncementParams, "to">): Promise<{ subject: string; html: string }>;
  sendBlogPostAnnouncement(params: BlogPostAnnouncementParams): Promise<void>;
  /** COURSE-ANNOUNCE-01: the dry run's sample — rendered, never sent. */
  renderCourseAnnouncement(params: Omit<CourseAnnouncementParams, "to">): Promise<{ subject: string; html: string }>;
  sendCourseAnnouncement(params: CourseAnnouncementParams): Promise<void>;
}
