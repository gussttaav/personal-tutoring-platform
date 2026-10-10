/**
 * ADMIN-01: Protected admin layout.
 * Redirects non-admins to "/" using the isAdmin helper (REL-03).
 * SEO-02: robots noindex — admin must never appear in search results
 * (robots.txt disallow blocks crawling but not indexing of linked URLs).
 * BUILD-01: force dynamic rendering — admin pages fetch data directly in the
 * server component (not gated by a dynamic API call of their own), so nothing
 * stops Next from trying to statically prerender them at build time using the
 * service-role Supabase client. Forcing it here (cascades to all nested pages)
 * keeps that fetch out of the build entirely.
 * ADMIN-02: the shell is now a grouped sidebar / mobile drawer (AdminShell). The
 * layout reads the sidebar's badge counts after the gate; a failed read renders
 * the sidebar without badges (adminService.navCounts answers null).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { adminService } from "@/services";
import { AdminShell } from "@/components/admin/AdminShell";
import "./admin.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin — gustavoai.dev",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!isAdmin(session)) {
    redirect("/");
  }

  const counts = await adminService.navCounts();

  return (
    <AdminShell
      counts={counts}
      userName={session?.user?.name ?? ""}
      userEmail={session?.user?.email ?? ""}
    >
      {children}
    </AdminShell>
  );
}
