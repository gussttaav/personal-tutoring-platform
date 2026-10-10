/**
 * ADMIN-02: the admin panel's shell (replaces AdminNav's single pill row, which ran
 * out of room at nine sections and scrolled sideways on a phone).
 *
 *   ≥ 1200 px   grouped left sidebar; the admin can collapse it to an icon rail
 *               (remembered in localStorage).
 *   900–1199    the icon rail, always (CSS — the toggle is hidden there).
 *   < 900 px    a sticky top bar with the section name; its menu button slides the
 *               same sidebar in as a drawer.
 *
 * One `<aside>` serves all three: the layout is CSS, this component only owns the
 * drawer's open state and the rail preference. The drawer follows MobileLessonBar's
 * dismissal pattern — scroll lock, Escape, backdrop click, a focus trap, and focus
 * restored to the menu button on close — and closes itself on navigation (each link's
 * onClick) and when the viewport grows past the drawer breakpoint.
 *
 * Badges (failed bookings, open reports) come from the layout's `navCounts()`; null
 * means the read failed and the sidebar renders without them.
 *
 * BLOG-15: «Avisos del blog» (/admin/blog-announce) beside the course announcements.
 */
"use client";

import Form from "next/form";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import BrandLogo from "@/components/BrandLogo";
import { initials } from "@/components/admin/format";
import { lockBodyScroll } from "@/hooks/scroll-lock";
import type { AdminNavCounts } from "@/domain/types";

type NavItem = {
  href:   string;
  label:  string;
  icon:   string;
  badge?: keyof AdminNavCounts;
  tone?:  "red" | "amber";
};

type NavSection = { label?: string; items: NavItem[] };

const NAV: NavSection[] = [
  { items: [{ href: "/admin", label: "Resumen", icon: "dashboard" }] },
  {
    label: "Operaciones",
    items: [
      { href: "/admin/students", label: "Alumnos", icon: "groups" },
      { href: "/admin/bookings", label: "Reservas", icon: "calendar_month" },
      { href: "/admin/failed-bookings", label: "Reservas fallidas", icon: "error", badge: "failedBookings", tone: "red" },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { href: "/admin/payments", label: "Pagos", icon: "payments" },
      { href: "/admin/pricing", label: "Precios", icon: "sell" },
    ],
  },
  {
    label: "Contenido",
    items: [
      { href: "/admin/course-announce", label: "Anuncios de cursos", icon: "campaign" },
      { href: "/admin/blog-announce", label: "Avisos del blog", icon: "notifications_active" },
      { href: "/admin/feedback", label: "Feedback", icon: "rate_review", badge: "openReports", tone: "amber" },
    ],
  },
  {
    label: "Ajustes",
    items: [{ href: "/admin/schedule", label: "Horarios", icon: "schedule" }],
  },
];

const isActive = (pathname: string, href: string): boolean =>
  pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));

/** Must match the drawer breakpoint in admin.css (`max-width: 899px`). */
const DESKTOP_QUERY = "(min-width: 900px)";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* ─── Rail preference (localStorage, via useSyncExternalStore) ─────────────────
 * A module-level copy keeps the toggle working when storage throws (private mode,
 * blocked site data); storage only makes it survive a reload. */

const RAIL_KEY = "gt:admin-rail";
const railListeners = new Set<() => void>();
let railMemory: boolean | null = null;

function readRail(): boolean {
  if (railMemory !== null) return railMemory;
  try {
    return window.localStorage.getItem(RAIL_KEY) === "1";
  } catch {
    return false;
  }
}

function writeRail(value: boolean): void {
  railMemory = value;
  try {
    window.localStorage.setItem(RAIL_KEY, value ? "1" : "0");
  } catch {
    // Storage unavailable: the in-memory value still applies for this visit.
  }
  railListeners.forEach((notify) => notify());
}

function subscribeRail(notify: () => void): () => void {
  railListeners.add(notify);
  return () => railListeners.delete(notify);
}

/* ─── Shell ──────────────────────────────────────────────────────────────── */

export function AdminShell({
  counts,
  userName,
  userEmail,
  children,
}: {
  counts:    AdminNavCounts | null;
  userName:  string;
  userEmail: string;
  children:  ReactNode;
}) {
  const pathname = usePathname();
  const rail = useSyncExternalStore(subscribeRail, readRail, () => false);
  const [open, setOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const current = NAV.flatMap((s) => s.items).find((item) => isActive(pathname, item.href));

  // Scroll lock + Escape + focus trap while the drawer is open; focus back to the
  // menu button on close.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = triggerRef.current;
    const releaseScroll = lockBodyScroll();

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Rotating a tablet past the breakpoint turns the drawer back into the sidebar.
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const onViewport = () => {
      if (desktop.matches) close();
    };

    window.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onViewport);
    return () => {
      releaseScroll();
      window.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onViewport);
      previouslyFocused?.focus();
    };
  }, [open, close]);

  const shellClass = ["admin-shell", rail ? "is-rail" : "", open ? "is-open" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      <aside id="admin-sidebar" ref={panelRef} className="admin-side" aria-label="Navegación del panel">
        <div className="admin-side-in">
          <div className="admin-brand">
            <Link href="/admin" className="admin-brand-link" onClick={close} aria-label="Admin, ir al resumen">
              <BrandLogo size={24} />
              <span className="admin-brand-word">
                GUSTAVO<span className="admin-brand-accent">AI.DEV</span>
              </span>
            </Link>
            <span className="admin-brand-tag">Admin</span>
            <button type="button" className="admin-icon-btn admin-drawer-close" onClick={close} aria-label="Cerrar menú">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Same GET search as /admin/students (?q=), from any admin page. */}
          <Form action="/admin/students" className="admin-side-search" onSubmit={close}>
            <span className="material-symbols-outlined" aria-hidden="true">search</span>
            <input
              type="search"
              name="q"
              placeholder="Buscar alumno…"
              aria-label="Buscar alumno por nombre o email"
              title="Buscar alumno"
            />
          </Form>

          <nav className="admin-side-nav">
            {NAV.map((section, i) => (
              <div key={section.label ?? i} className="admin-nav-sec">
                {section.label && <div className="admin-nav-sec-label">{section.label}</div>}
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const count = item.badge && counts ? counts[item.badge] : 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={close}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                      className={`admin-nav-item${active ? " is-active" : ""}`}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
                      <span className="admin-nav-label">{item.label}</span>
                      {count > 0 && (
                        <span className={`admin-nav-badge tone-${item.tone}`}>
                          {count}
                          <span className="admin-sr"> pendientes</span>
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="admin-side-foot">
            <a href="/" className="admin-nav-item" target="_blank" rel="noopener noreferrer" title="Ver la web">
              <span className="material-symbols-outlined" aria-hidden="true">open_in_new</span>
              <span className="admin-nav-label">Ver la web</span>
            </a>
            <button
              type="button"
              className="admin-nav-item admin-rail-toggle"
              onClick={() => writeRail(!rail)}
              aria-pressed={rail}
              title={rail ? "Expandir menú" : "Contraer menú"}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {rail ? "left_panel_open" : "left_panel_close"}
              </span>
              <span className="admin-nav-label">{rail ? "Expandir menú" : "Contraer menú"}</span>
            </button>
            <div className="admin-user" title={userEmail}>
              <div className="admin-user-avatar" aria-hidden="true">{initials(userName || userEmail)}</div>
              <div className="admin-user-meta">
                <span className="admin-user-name">{userName || userEmail}</span>
                <span className="admin-user-role">Administrador</span>
              </div>
              <button
                type="button"
                className="admin-icon-btn admin-user-out"
                onClick={() => signOut({ callbackUrl: "/" })}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <span className="material-symbols-outlined">logout</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <button type="button" className="admin-scrim" tabIndex={-1} aria-label="Cerrar menú" onClick={close} />

      <div className="admin-body">
        <header className="admin-topbar">
          <button
            ref={triggerRef}
            type="button"
            className="admin-topbar-btn"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={open}
            aria-controls="admin-sidebar"
          >
            <span className="material-symbols-outlined">menu</span>
            {counts && counts.failedBookings + counts.openReports > 0 && <span className="admin-topbar-dot" />}
          </button>
          <div className="admin-topbar-title">
            <span className="admin-topbar-over">Admin</span>
            <span className="admin-topbar-name">{current?.label ?? "Panel"}</span>
          </div>
          <Link href="/admin" className="admin-topbar-logo" aria-label="Ir al resumen">
            <BrandLogo size={24} />
          </Link>
        </header>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
