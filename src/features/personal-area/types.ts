export interface UserBooking {
  eventId:     string;   // Google Calendar event id; lookup key consumed by the mobile app
  token:       string;
  joinToken:   string;
  sessionType: "free15min" | "session1h" | "session2h" | "pack";
  startsAt:    string;   // ISO 8601
  endsAt:      string;   // ISO 8601
  packSize?:   number;   // only for sessionType "pack"
}

export type BookingsState = "loading" | "error" | UserBooking[];
