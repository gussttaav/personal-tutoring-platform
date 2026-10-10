/**
 * ADMIN-01: Admin bookings list — all bookings ordered by start time (most recent first).
 * SEC-07: gated before its own data fetch — see students/page.tsx sibling note.
 * REFACTOR-R4-P3-02: reads through adminService (was ../_data).
 * ADMIN-03: passes the tutor's timezone (ScheduleConfig.timezone) to the table.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { adminService, scheduleService } from "@/services";
import { BookingsTable } from "@/components/admin/BookingsTable";

export default async function BookingsPage() {
  if (!isAdmin(await auth())) redirect("/");

  const [bookings, schedule] = await Promise.all([
    adminService.listAllBookings(),
    scheduleService.getConfig(),
  ]);
  return <BookingsTable bookings={bookings} timeZone={schedule.timezone} />;
}
