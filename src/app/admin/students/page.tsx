/**
 * ADMIN-01: Student list with optional low-credit filter.
 */

import { fetchStudents } from "../_data";
import { StudentsTable } from "@/components/admin/StudentsTable";

interface StudentsPageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const { filter } = await searchParams;
  // Fetch the full list; filter + search are applied client-side so the tab
  // counts stay accurate without extra queries.
  const students = await fetchStudents();

  return <StudentsTable students={students} filter={filter} />;
}
