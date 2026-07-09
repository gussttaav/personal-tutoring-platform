/**
 * ADMIN-01: Protected admin layout.
 * Redirects non-admins to "/" using the isAdmin helper (REL-03).
 * SEO-02: robots noindex — admin must never appear in search results
 * (robots.txt disallow blocks crawling but not indexing of linked URLs).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import "./admin.css";

export const metadata = {
  title: "Admin — gustavoai.dev",
  robots: { index: false, follow: false },
};

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
