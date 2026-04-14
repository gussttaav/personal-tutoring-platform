export interface UserBooking {
  token:       string;
  sessionType: "free15min" | "session1h" | "session2h" | "pack";
  startsAt:    string;   // ISO 8601
  endsAt:      string;   // ISO 8601
  packSize?:   number;   // only for sessionType "pack"
}

export type BookingsState = "loading" | "error" | UserBooking[];
