/**
 * ADMIN-01: Student list with optional low-credit filter.
 *
 * REFACTOR-R4-P3-02: search (?q=), the low-credit tab (?filter=) and pagination (?page=)
 * run in Postgres through adminService.listStudents. Students only: a user with a
 * booking or a credit pack.
 *
 * SEC-07: the page gates ITSELF before fetching, on top of the layout's gate. Next
 * renders a layout and its page segment in parallel, so the layout's `redirect()`
 * does not stop this page from rendering — and the rendered RSC payload (data
 * included) is embedded in the 307 document an unauthenticated request receives.
 * Checking here, before the data fetch, means a non-admin request never reaches
 * the data. Same fix applied to every other admin page segment.
 *
 * ADMIN-03: passes the tutor's timezone (ScheduleConfig.timezone) to the table.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { AdminStudentsQuerySchema } from "@/lib/schemas";
import { adminService, scheduleService } from "@/services";
import { STUDENTS_PAGE_SIZE } from "@/services/AdminService";
import { StudentsTable } from "@/components/admin/StudentsTable";

interface StudentsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  if (!isAdmin(await auth())) redirect("/");

  const { q, filter, page } = AdminStudentsQuerySchema.parse(await searchParams);
  const query = q ?? "";
  // One call carries both tab counts (computed before the low-credit filter).
  const [{ rows, total, lowCreditTotal }, schedule] = await Promise.all([
    adminService.listStudents({
      query,
      lowCredit: filter === "low-credit",
      page,
      pageSize:  STUDENTS_PAGE_SIZE,
    }),
    scheduleService.getConfig(),
  ]);

  return (
    <StudentsTable
      rows={rows}
      total={total}
      lowCreditTotal={lowCreditTotal}
      page={page}
      pageSize={STUDENTS_PAGE_SIZE}
      filter={filter}
      query={query}
      timeZone={schedule.timezone}
    />
  );
}
