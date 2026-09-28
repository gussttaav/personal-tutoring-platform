// ARCH-13: Email client interface — enables testing BookingService with mocks.
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

export interface IEmailClient {
  sendConfirmation(params: ConfirmationEmailParams): Promise<void>;
  sendNewBookingNotification(params: NewBookingNotificationParams): Promise<void>;
  sendCancellationConfirmation(params: CancellationConfirmationParams): Promise<void>;
  sendCancellationNotification(params: CancellationNotificationParams): Promise<void>;
  sendContentReportNotification(params: ContentReportNotificationParams): Promise<void>;
}
