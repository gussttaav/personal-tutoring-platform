/**
 * ADMIN-01: Protected admin layout.
 * Redirects non-admins to "/" using the isAdmin helper (REL-03).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import "./admin.css";

export const metadata = { title: "Admin — gustavoai.dev" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!isAdmin(session)) {
    redirect("/");
  }

  return (
    <div className="admin-shell">
      <AdminNav />
      <main className="admin-main">{children}</main>
    </div>
  );
}
