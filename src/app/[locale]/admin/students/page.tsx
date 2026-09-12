/**
 * ADMIN-01: Student list with optional low-credit filter.
 *
 * SEC-07: the page gates ITSELF before fetching, on top of the layout's gate. Next
 * renders a layout and its page segment in parallel, so the layout's `redirect()`
 * does not stop this page from rendering — and the rendered RSC payload (data
 * included) is embedded in the 307 document an unauthenticated request receives.
 * Checking here, before the data fetch, means a non-admin request never reaches
 * the data. Same fix applied to every other admin page segment.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { fetchStudents } from "../_data";
import { StudentsTable } from "@/components/admin/StudentsTable";

interface StudentsPageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  if (!isAdmin(await auth())) redirect("/");

  const { filter } = await searchParams;
  // Fetch the full list; filter + search are applied client-side so the tab
  // counts stay accurate without extra queries.
  const students = await fetchStudents();

  return <StudentsTable students={students} filter={filter} />;
}
