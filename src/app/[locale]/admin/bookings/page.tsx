/**
 * ADMIN-01: Admin bookings list — all bookings ordered by start time (most recent first).
 * SEC-07: gated before its own data fetch — see students/page.tsx sibling note.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { fetchAllBookings } from "../_data";
import { BookingsTable } from "@/components/admin/BookingsTable";

export default async function BookingsPage() {
  if (!isAdmin(await auth())) redirect("/");

  const bookings = await fetchAllBookings();
  return <BookingsTable bookings={bookings} />;
}
