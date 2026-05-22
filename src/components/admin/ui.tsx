/**
 * ADMIN-01: Shared presentational primitives for the admin panel.
 * Ported from the redesign prototype (admin-app.jsx). Server-safe (no hooks).
 * Trend deltas from the prototype were intentionally dropped — no backend source.
 */

import Link from "next/link";
import type { ReactNode } from "react";

/* ─── Status badge ───────────────────────────────────────────────────── */

type BadgeKind = "booking" | "payment";

const BADGE_MAP: Record<BadgeKind, Record<string, { c: string; bg: string; label: string }>> = {
  booking: {
    confirmed: { c: "var(--green)", bg: "var(--green-dim)", label: "Confirmada" },
    completed: { c: "#9ec5ff", bg: "rgba(158,197,255,0.10)", label: "Completada" },
    cancelled: { c: "var(--text-dim)", bg: "rgba(255,255,255,0.05)", label: "Cancelada" },
    no_show: { c: "var(--error)", bg: "var(--error-bg)", label: "No asistió" },
  },
  payment: {
    succeeded: { c: "var(--green)", bg: "var(--green-dim)", label: "Cobrado" },
    pending: { c: "var(--warning)", bg: "var(--warning-bg)", label: "Pendiente" },
    refunded: { c: "#9ec5ff", bg: "rgba(158,197,255,0.10)", label: "Reembolso" },
    failed: { c: "var(--error)", bg: "var(--error-bg)", label: "Fallido" },
  },
};

export function StatusBadge({ status, kind = "booking" }: { status: string; kind?: BadgeKind }) {
  const s =
    BADGE_MAP[kind][status] ?? { c: "var(--text-dim)", bg: "rgba(255,255,255,0.05)", label: status };
  return (
    <span className="badge" style={{ color: s.c, background: s.bg }}>
      <span className="badge-dot" style={{ background: s.c }} />
      {s.label}
    </span>
  );
}

/* ─── Page header ────────────────────────────────────────────────────── */

export function PageHeader({
  overline,
  title,
  subtitle,
  right,
}: {
  overline?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {overline && <div className="overline">{overline}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {right && <div className="page-header-right">{right}</div>}
    </header>
  );
}

/* ─── Stat card ──────────────────────────────────────────────────────── */

export function StatCard({
  label,
  value,
  href,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  href: string;
  tone?: "neutral" | "alert";
  icon?: string;
}) {
  const isAlert = tone === "alert";
  return (
    <Link href={href} className={`stat-card ${isAlert ? "is-alert" : ""}`}>
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {icon && <span className="stat-card-icon material-symbols-outlined">{icon}</span>}
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-cta">
        Ver detalle <span className="material-symbols-outlined">arrow_forward</span>
      </div>
    </Link>
  );
}

/* ─── Card ───────────────────────────────────────────────────────────── */

export function Card({
  title,
  action,
  children,
  padding = true,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  padding?: boolean;
}) {
  return (
    <section className="card">
      {(title || action) && (
        <header className="card-header">
          {title && <h2 className="card-title">{title}</h2>}
          {action}
        </header>
      )}
      <div className={padding ? "card-body" : ""}>{children}</div>
    </section>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────── */

export function Empty({ icon = "inbox", label }: { icon?: string; label: string }) {
  return (
    <div className="empty">
      <span className="material-symbols-outlined">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
