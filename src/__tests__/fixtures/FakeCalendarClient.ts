// TEST-01: Fake ICalendarClient for integration tests.
import type { ICalendarClient, CreateEventParams, CreateEventResult, TimeSlot } from "@/infrastructure/google/ICalendarClient";
import type { ScheduleConfig } from "@/domain/types";

export class FakeCalendarClient implements ICalendarClient {
  createdEvents:        CreateEventParams[] = [];
  deletedEventIds:      string[]            = [];
  shouldFail            = false;
  createEventShouldFail = false;
  deleteEventShouldFail = false;
  private counter       = 0;

  async createEvent(params: CreateEventParams): Promise<CreateEventResult> {
    if (this.shouldFail || this.createEventShouldFail) throw new Error("FakeCalendarClient: simulated failure");

    const eventId = `evt-${this.counter++}`;
    this.createdEvents.push(params);
    return {
      eventId,
      zoomSessionName: `session-${eventId}`,
      zoomPasscode:    "pass123",
      zoomSessionId:   `zsid-${eventId}`,
      durationMinutes: 60,
    };
  }

  async deleteEvent(eventId: string): Promise<void> {
    if (this.shouldFail || this.deleteEventShouldFail) throw new Error("FakeCalendarClient: simulated failure");
    this.deletedEventIds.push(eventId);
  }

  async getAvailableSlots(_dateStr: string, _durationMinutes: number, _config: ScheduleConfig): Promise<TimeSlot[]> {
    return [];
  }
}
