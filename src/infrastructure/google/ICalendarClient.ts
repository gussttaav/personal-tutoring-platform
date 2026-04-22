// ARCH-13: Calendar client interface — enables testing BookingService with mocks.
// ARCH-16: Added TimeSlot type and getAvailableSlots method.
import type { SessionType } from "@/domain/types";

export interface TimeSlot {
  start: string;
  end:   string;
  label: string;
}

export interface CreateEventParams {
  summary:      string;
  description:  string;
  startIso:     string;
  endIso:       string;
  sessionType:  SessionType;
  studentEmail: string;
}

export interface CreateEventResult {
  eventId:         string;
  zoomSessionName: string;
  zoomPasscode:    string;
  zoomSessionId:   string;
  durationMinutes: number;
}

export interface ICalendarClient {
  getAvailableSlots(dateStr: string, durationMinutes: number): Promise<TimeSlot[]>;
  createEvent(params: CreateEventParams): Promise<CreateEventResult>;
  deleteEvent(eventId: string): Promise<void>;
}
