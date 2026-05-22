/**
 * ADMIN-01: Shared formatting helpers for the admin panel.
 * Ported from the redesign prototype (admin-app.jsx).
 */

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

export const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

export const fmtShort = (iso: string): string =>
  new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export const relativeTime = (iso: string): string => {
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60000);
  const hrs = Math.round(abs / 3600000);
  const dys = Math.round(abs / 86400000);
  let s: string;
  if (mins < 60) s = `${mins} min`;
  else if (hrs < 24) s = `${hrs} h`;
  else s = `${dys} d`;
  return diffMs < 0 ? `hace ${s}` : `en ${s}`;
};

/** First letters of up to the first two name parts, e.g. "Diego Ramírez" → "DR". */
export const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .map((n) => n[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
