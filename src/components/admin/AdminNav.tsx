/**
 * ADMIN-01: Admin navigation bar (redesigned).
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";

const NAV_LINKS = [
  { href: "/admin", label: "Panel", icon: "dashboard" },
  { href: "/admin/students", label: "Alumnos", icon: "groups" },
  { href: "/admin/bookings", label: "Reservas", icon: "calendar_month" },
  { href: "/admin/failed-bookings", label: "Fallidas", icon: "error" },
  { href: "/admin/payments", label: "Pagos", icon: "payments" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav">
      <div className="admin-nav-inner">
        <Link href="/admin" className="admin-nav-brand">
          <BrandLogo size={20} />
          <span className="admin-nav-wordmark">
            GUSTAVO<span className="admin-nav-wordmark-accent">AI.DEV</span>
          </span>
        </Link>
        <div className="admin-nav-links">
          {NAV_LINKS.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/admin" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`admin-nav-link ${active ? "is-active" : ""}`}
              >
                <span className="material-symbols-outlined">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
