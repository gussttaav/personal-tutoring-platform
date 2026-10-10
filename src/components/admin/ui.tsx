/**
 * ADMIN-01: Shared presentational primitives for the admin panel.
 * Ported from the redesign prototype (admin-app.jsx). Server-safe (no hooks).
 * Trend deltas from the prototype were intentionally dropped — no backend source.
 * ADMIN-02: StatCard is the redesigned KPI tile (icon chip, value, a footnote line);
 * Card takes an optional count chip beside its title; Empty has a "good" tone for
 * the all-clear states (a green filled check instead of a grey icon).
 */

import Link from "next/link";
import type { ReactNode } from "react";

/* ─── Status badge ───────────────────────────────────────────────────── */

type BadgeKind = "booking" | "payment" | "report";

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
  // CONTENT-FEEDBACK-01: error reports on lessons / posts.
  report: {
    open: { c: "var(--warning)", bg: "var(--warning-bg)", label: "Abierto" },
    resolved: { c: "var(--green)", bg: "var(--green-dim)", label: "Resuelto" },
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

/* ─── Stat card (KPI tile) ─────────────────────────────────────────────── */

export type StatTone = "neutral" | "green" | "amber" | "red";

export function StatCard({
  label,
  value,
  href,
  icon,
  foot,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  href:  string;
  icon:  string;
  /** One short line under the value: what the number means or what's next. */
  foot?: string;
  tone?: StatTone;
}) {
  return (
    <Link href={href} className={`kpi${tone === "neutral" ? "" : ` tone-${tone}`}`}>
      <div className="kpi-head">
        <span className="kpi-icon">
          <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
        </span>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-foot">
        <span>{foot ?? "Ver detalle"}</span>
        <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
      </div>
    </Link>
  );
}

/* ─── Card ───────────────────────────────────────────────────────────── */

export function Card({
  title,
  count,
  countTone,
  action,
  children,
  padding = true,
  className,
}: {
  title?: string;
  /** A small chip beside the title (a row count). */
  count?: ReactNode;
  countTone?: "red";
  action?: ReactNode;
  children: ReactNode;
  padding?: boolean;
  className?: string;
}) {
  return (
    <section className={className ? `card ${className}` : "card"}>
      {(title || action) && (
        <header className="card-header">
          {title && (
            <h2 className="card-title">
              {title}
              {count !== undefined && (
                <span className={`card-count${countTone ? ` is-${countTone}` : ""}`}>{count}</span>
              )}
            </h2>
          )}
          {action}
        </header>
      )}
      <div className={padding ? "card-body" : ""}>{children}</div>
    </section>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────── */

export function Empty({
  icon = "inbox",
  label,
  tone,
}: {
  icon?: string;
  label: string;
  /** "good": an all-clear state (green filled icon). */
  tone?: "good";
}) {
  return (
    <div className={tone === "good" ? "empty is-good" : "empty"}>
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
