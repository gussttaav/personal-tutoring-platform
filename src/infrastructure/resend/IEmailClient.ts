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

export interface IEmailClient {
  sendConfirmation(params: ConfirmationEmailParams): Promise<void>;
  sendNewBookingNotification(params: NewBookingNotificationParams): Promise<void>;
  sendCancellationConfirmation(params: CancellationConfirmationParams): Promise<void>;
  sendCancellationNotification(params: CancellationNotificationParams): Promise<void>;
}
