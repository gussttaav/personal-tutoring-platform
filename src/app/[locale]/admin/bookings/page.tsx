/**
 * ADMIN-01: Admin bookings list — all bookings ordered by start time (most recent first).
 */

import { fetchAllBookings } from "../_data";
import { BookingsTable } from "@/components/admin/BookingsTable";

export default async function BookingsPage() {
  const bookings = await fetchAllBookings();
  return <BookingsTable bookings={bookings} />;
}
