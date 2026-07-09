// ARCH-13: Calendar client interface — enables testing BookingService with mocks.
// ARCH-16: Added TimeSlot type and getAvailableSlots method.
import type { ScheduleConfig, SessionType } from "@/domain/types";

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
  /** IANA timezone the Calendar event should be created in (from ScheduleConfig). */
  timezone:     string;
}

export interface CreateEventResult {
  eventId:         string;
  zoomSessionName: string;
  zoomPasscode:    string;
  zoomSessionId:   string;
  durationMinutes: number;
}

export interface ICalendarClient {
  getAvailableSlots(dateStr: string, durationMinutes: number, config: ScheduleConfig, stepMinutes?: number): Promise<TimeSlot[]>;
  createEvent(params: CreateEventParams): Promise<CreateEventResult>;
  deleteEvent(eventId: string): Promise<void>;
}
