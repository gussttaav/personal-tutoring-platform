"use client";

/**
 * PersonalAreaCalendar
 *
 * Weekly time-grid showing the student's booked sessions.
 *
 * Grid structure (matches AvailabilityModal style):
 *   8 columns: 52px time column + 7 × 1fr day columns
 *   Each hour row = two 30-min half-rows (HALF_H px each) + 1px divider
 *
 * Session rendering:
 *   free15min   → half-row block (top half if :00/:15, bottom half if :30/:45)
 *   session1h   → absolute overlay spanning the full hour row (both halves)
 *   pack        → same as session1h
 *   session2h   → overlay spanning the current row; continuation bar in the next
 *
 * Context menu:
 *   Rendered at position:fixed (avoids overflow clipping from grid containers).
 *   Opens on slot click, closes on outside click.
 *
 * Actions:
 *   Join        → /sesion/{token}
 *   Reschedule  → /?reschedule={sessionType}&token={token}
 *   Cancel      → POST /api/cancel + onBookingCancelled() callback
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
} from "react";
import { useRouter } from "next/navigation";
import type { UserBooking } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_ROWS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

const DAY_ABBR = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
const DAY_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionSpec {
  booking:   UserBooking;
  H:         number;   // start hour
  M:         number;   // start minute (0 or 30)
  durationH: number;   // 1 or 2
}

interface DayLookup {
  /**
   * Hours that are fully overlaid by a session (both halves).
   * Used to suppress the internal 30-min divider (it would show through the semi-transparent overlay).
   */
  coveredHours: Set<number>;
  /** free15min slots keyed by "${hour}-${0|1}" (0=top half, 1=bottom half). */
  halves: Map<string, UserBooking>;
  /** All non-free15min sessions — rendered as a single SpanBlock at DayColumn level. */
  sessions: SessionSpec[];
}

interface OpenMenu {
  booking: UserBooking;
  rect:    DOMRect;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

function sessionColors(type: string) {
  if (type === "session1h" || type === "session2h") {
    return { bg: "rgba(78,222,163,0.15)", border: "rgba(78,222,163,0.4)",  text: "#4edea3" };
  }
  return   { bg: "rgba(158,210,181,0.15)", border: "rgba(158,210,181,0.35)", text: "#9ed2b5" };
}

function blockLabel(booking: UserBooking, short: boolean): string {
  if (short) {
    if (booking.sessionType === "session2h") return "2h";
    if (booking.sessionType === "free15min") return "15 min";
    return "1h";
  }
  switch (booking.sessionType) {
    case "free15min": return "15 min. Gratis";
    case "session1h": return "1h Individual";
    case "session2h": return "2h Individual";
    case "pack":      return booking.packSize === 10 ? "1h Pack10h" : "1h Pack5h";
    default:          return "1h";
  }
}

function fullLabel(booking: UserBooking): string {
  switch (booking.sessionType) {
    case "free15min": return "Encuentro inicial · 15 min";
    case "session1h": return "Sesión individual · 1 hora";
    case "session2h": return "Sesión individual · 2 horas";
    case "pack":      return booking.packSize === 10 ? "Clase de pack (10h)" : "Clase de pack (5h)";
    default:          return "Sesión";
  }
}

// ─── Week helpers ─────────────────────────────────────────────────────────────

function mondayOf(date: Date): Date {
  const d   = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function fmtHour(h: number): string {
  if (h < 12)   return `${String(h).padStart(2, "0")} AM`;
  if (h === 12) return "12 PM";
  return `${String(h - 12).padStart(2, "0")} PM`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Lookup builder ───────────────────────────────────────────────────────────

function buildDayLookup(bookings: UserBooking[], dayDate: Date): DayLookup {
  const coveredHours = new Set<number>();
  const halves       = new Map<string, UserBooking>();
  const sessions:    SessionSpec[] = [];
  const dk           = dateKey(dayDate);

  for (const b of bookings) {
    const start = new Date(b.startsAt);
    if (dateKey(start) !== dk) continue;

    const H = start.getHours();
    const M = start.getMinutes();

    if (b.sessionType === "free15min") {
      // Single half-row only — no span needed
      halves.set(`${H}-${M < 30 ? 0 : 1}`, b);
    } else {
      const durationH = b.sessionType === "session2h" ? 2 : 1;

      // Track which full-hour rows are covered so we can hide their internal dividers
      if (M < 30) {
        for (let d = 0; d < durationH; d++) coveredHours.add(H + d);
      }
      // :30-start sessions don't fully cover any hour row's divider

      sessions.push({ booking: b, H, M, durationH });
    }
  }

  return { coveredHours, halves, sessions };
}

// ─── Menu position ────────────────────────────────────────────────────────────

function menuPosition(rect: DOMRect): { top: number; left: number } {
  const menuW  = 208;
  const menuH  = 180;
  const margin = 8;

  let left = rect.right + margin;
  if (left + menuW > window.innerWidth - margin) {
    left = rect.left - menuW - margin;
  }

  let top = rect.top + rect.height / 2 - menuH / 2;
  top = Math.max(margin, Math.min(top, window.innerHeight - menuH - margin));

  return { top, left };
}

// ─── Context menu (fixed position) ───────────────────────────────────────────

interface ContextMenuProps {
  booking:     UserBooking;
  rect:        DOMRect;
  onClose:     () => void;
  onCancelled: () => void;
}

const ContextMenu = forwardRef<HTMLDivElement, ContextMenuProps>(
  ({ booking, rect, onClose, onCancelled }, ref) => {
    const router = useRouter();
    const [phase, setPhase]     = useState<"idle" | "confirm" | "busy" | "error">("idle");
    const [errMsg, setErrMsg]   = useState("");
    const { top, left }         = menuPosition(rect);

    async function doCancel() {
      setPhase("busy");
      try {
        const res  = await fetch("/api/cancel", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ token: booking.token }),
        });
        const data = await res.json();
        if (!res.ok) { setErrMsg(data.error ?? "Error al cancelar."); setPhase("error"); return; }
        onClose();
        onCancelled();
      } catch {
        setErrMsg("Error de conexión. Inténtalo de nuevo.");
        setPhase("error");
      }
    }

    const baseStyle: React.CSSProperties = {
      position:     "fixed",
      top,
      left,
      zIndex:       9999,
      width:        208,
      background:   "#2a2a2c",
      border:       "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      boxShadow:    "0 20px 48px rgba(0,0,0,0.6)",
      padding:      6,
    };

    if (phase === "idle") return (
      <div ref={ref} style={baseStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ padding: "8px 12px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 4 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#86948a", margin: 0 }}>
            {fullLabel(booking)}
          </p>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#bbcabf", margin: "3px 0 0" }}>
            {fmtTime(booking.startsAt)} – {fmtTime(booking.endsAt)}
          </p>
        </div>
        <CMenuItem icon="play_circle"  label="Entrar al aula"  color="#4edea3" onClick={() => { onClose(); router.push(`/sesion/${booking.token}`); }} />
        <CMenuItem icon="event_repeat" label="Reprogramar"     color="#e5e1e4" onClick={() => { onClose(); router.push(`/?reschedule=${booking.sessionType}&token=${booking.token}`); }} />
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
        <CMenuItem icon="cancel"       label="Cancelar"        color="#ffb4ab" onClick={() => setPhase("confirm")} />
      </div>
    );

    if (phase === "confirm") return (
      <div ref={ref} style={baseStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ padding: "12px 14px" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#e5e1e4", margin: "0 0 6px" }}>¿Cancelar esta sesión?</p>
          <p style={{ fontSize: 11, color: "#86948a", margin: "0 0 14px" }}>Esta acción no se puede deshacer.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setPhase("idle")} style={cancelBtnBase}>No</button>
            <button onClick={doCancel} style={{ ...cancelBtnBase, background: "#ffb4ab", border: "none", color: "#690005", fontWeight: 700 }}>
              Sí, cancelar
            </button>
          </div>
        </div>
      </div>
    );

    if (phase === "busy") return (
      <div ref={ref} style={{ ...baseStyle, display: "flex", alignItems: "center", justifyContent: "center", height: 80 }} onMouseDown={(e) => e.stopPropagation()}>
        <Dots />
      </div>
    );

    return (
      <div ref={ref} style={baseStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ padding: "12px 14px" }}>
          <p style={{ fontSize: 11, color: "#ffb4ab", margin: "0 0 12px" }}>{errMsg}</p>
          <button onClick={() => setPhase("idle")} style={cancelBtnBase}>Cerrar</button>
        </div>
      </div>
    );
  }
);
ContextMenu.displayName = "ContextMenu";

const cancelBtnBase: React.CSSProperties = {
  flex: 1, padding: "7px 0", borderRadius: 6,
  background: "none", border: "1px solid rgba(255,255,255,0.1)",
  color: "#86948a", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
};

function CMenuItem({ icon, label, color, onClick }: { icon: string; label: string; color: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        padding: "8px 10px", borderRadius: 8,
        background: hov ? "rgba(255,255,255,0.06)" : "transparent",
        border: "none", color, fontSize: 12, fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        transition: "background 0.1s",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 16, flexShrink: 0, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      {label}
    </button>
  );
}

function Dots() {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: "#86948a",
          animation: `paDotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ─── Slot components ──────────────────────────────────────────────────────────

/** Free-15-min half-row slot (standalone, no connection logic needed). */
function HalfSlot({
  booking, isMobile, isToday, onOpen,
}: {
  booking:  UserBooking;
  isMobile: boolean;
  isToday:  boolean;
  onOpen:   (b: UserBooking, r: DOMRect) => void;
}) {
  const [hov, setHov] = useState(false);
  const colors        = sessionColors(booking.sessionType);

  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(booking, (e.currentTarget as HTMLElement).getBoundingClientRect());
      }}
      style={{
        position:       "absolute",
        inset:          "2px 3px",
        border:         `1px solid ${colors.border}`,
        background:     hov ? colors.bg.replace("0.15", "0.26") : colors.bg,
        borderRadius:   4,
        cursor:         "pointer",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        fontFamily:     "inherit",
        animation:      isToday ? "paBookingPulse 2.5s ease-in-out infinite" : "none",
        transition:     "background 0.12s",
        overflow:       "visible",
        zIndex:         2,
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 700, color: colors.text, pointerEvents: "none", userSelect: "none" }}>
        {blockLabel(booking, isMobile)}
      </span>
    </button>
  );
}

/**
 * SpanBlock — a single absolutely-positioned button rendered at the DayColumn level.
 *
 * topPx and heightPx are computed from the session's start time and duration so the
 * block spans the exact pixel area of the booking (e.g. 11:30–12:30 or 11:00–13:00).
 * Being a single element means:
 *   • the entire area is one click target (opens context menu)
 *   • text can be truly vertically centered inside the full block
 */
function SpanBlock({
  spec, topPx, heightPx, isMobile, isToday, onOpen,
}: {
  spec:     SessionSpec;
  topPx:    number;
  heightPx: number;
  isMobile: boolean;
  isToday:  boolean;
  onOpen:   (b: UserBooking, r: DOMRect) => void;
}) {
  const [hov, setHov] = useState(false);
  const colors        = sessionColors(spec.booking.sessionType);

  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(spec.booking, (e.currentTarget as HTMLElement).getBoundingClientRect());
      }}
      style={{
        position:       "absolute",
        top:            topPx,
        left:           3,
        right:          3,
        height:         heightPx,
        border:         `1px solid ${colors.border}`,
        background:     hov ? colors.bg.replace("0.15", "0.26") : colors.bg,
        borderRadius:   4,
        cursor:         "pointer",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        fontFamily:     "inherit",
        animation:      isToday ? "paBookingPulse 2.5s ease-in-out infinite" : "none",
        transition:     "background 0.12s",
        overflow:       "hidden",
        zIndex:         4,
      }}
    >
      <span style={{ fontSize: isMobile ? 8 : 9, fontWeight: 700, color: colors.text, pointerEvents: "none", userSelect: "none" }}>
        {blockLabel(spec.booking, isMobile)}
      </span>
    </button>
  );
}

// ─── Day column ───────────────────────────────────────────────────────────────

function DayColumn({
  date, bookings, isMobile, isToday, HALF_H, HEADER_H, onOpen,
}: {
  date:     Date;
  bookings: UserBooking[];
  isMobile: boolean;
  isToday:  boolean;
  HALF_H:   number;
  HEADER_H: number;
  onOpen:   (b: UserBooking, r: DOMRect) => void;
}) {
  const dow      = date.getDay();
  const lookup   = buildDayLookup(bookings, date);
  const todayStr = new Date().toDateString();
  const ROW_H    = HALF_H * 2 + 1;

  return (
    // position:relative makes this the containing block for SpanBlocks
    <div style={{ background: isToday ? "rgba(78,222,163,0.025)" : "#1c1b1d", position: "relative" }}>
      {/* Header */}
      <div style={{
        height:         HEADER_H,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        gap:            2,
        background:     isToday ? "rgba(78,222,163,0.10)" : "#111113",
        borderBottom:   "1px solid rgba(255,255,255,0.10)",
        position:       "relative",
      }}>
        {isToday && (
          <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 2, background: "#4edea3", borderRadius: "0 0 2px 2px" }} />
        )}
        <span style={{ fontSize: isMobile ? 8 : 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: isToday ? "#4edea3" : "#86948a", lineHeight: 1 }}>
          {isMobile ? DAY_ABBR[dow] : DAY_FULL[dow]}
        </span>
        <span style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, fontFamily: "var(--font-headline, Manrope), sans-serif", color: isToday ? "#4edea3" : "#e5e1e4", lineHeight: 1 }}>
          {date.getDate()}
        </span>
      </div>

      {/* Hour rows — grid lines + free15min half slots only */}
      {TIME_ROWS.map((hour, i) => {
        const topEntry = lookup.halves.get(`${hour}-0`) ?? null;
        const botEntry = lookup.halves.get(`${hour}-1`) ?? null;
        const isCovered = lookup.coveredHours.has(hour);

        return (
          <div
            key={hour}
            style={{
              position:  "relative",
              height:    ROW_H,
              borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
            }}
          >
            {/* Top half (30 min) */}
            <div style={{ height: HALF_H, position: "relative" }}>
              {topEntry && (
                <HalfSlot booking={topEntry} isMobile={isMobile} isToday={new Date(topEntry.startsAt).toDateString() === todayStr} onOpen={onOpen} />
              )}
            </div>

            {/* 30-min divider — hidden when a session overlay fully covers the row */}
            <div style={{ height: 1, background: isCovered ? "transparent" : "rgba(255,255,255,0.04)" }} />

            {/* Bottom half (30 min) */}
            <div style={{ height: HALF_H, position: "relative" }}>
              {botEntry && (
                <HalfSlot booking={botEntry} isMobile={isMobile} isToday={new Date(botEntry.startsAt).toDateString() === todayStr} onOpen={onOpen} />
              )}
            </div>
          </div>
        );
      })}

      {/* SpanBlocks — one per non-free15min session, positioned at column level */}
      {lookup.sessions.map((spec) => {
        const rowIdx  = TIME_ROWS.indexOf(spec.H);
        if (rowIdx < 0) return null;

        // topPx: distance from DayColumn top to the block's top edge (2px inset from time content)
        const topPx    = HEADER_H + rowIdx * ROW_H + (spec.M < 30 ? 2 : HALF_H + 3);
        // heightPx: same formula for all start-minute variants — verified algebraically
        const heightPx = spec.durationH * ROW_H - 4;
        const isToday  = new Date(spec.booking.startsAt).toDateString() === todayStr;

        return (
          <SpanBlock
            key={spec.booking.token}
            spec={spec}
            topPx={topPx}
            heightPx={heightPx}
            isMobile={isMobile}
            isToday={isToday}
            onOpen={onOpen}
          />
        );
      })}
    </div>
  );
}

// ─── Time column ──────────────────────────────────────────────────────────────

function TimeColumn({ isMobile, HALF_H, HEADER_H }: { isMobile: boolean; HALF_H: number; HEADER_H: number }) {
  return (
    <div style={{ background: "#111113" }}>
      <div style={{ height: HEADER_H, borderBottom: "1px solid rgba(255,255,255,0.10)" }} />
      {TIME_ROWS.map((hour, i) => (
        <div
          key={hour}
          style={{
            height:         HALF_H * 2 + 1,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "flex-end",
            paddingRight:   8,
            borderTop:      i > 0 ? "1px solid rgba(255,255,255,0.05)" : undefined,
          }}
        >
          <span style={{ fontSize: isMobile ? 9 : 10, fontWeight: 500, color: "#86948a", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {fmtHour(hour)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main calendar component ──────────────────────────────────────────────────

interface PersonalAreaCalendarProps {
  bookings:           UserBooking[];
  onBookingCancelled: () => void;
}

export default function PersonalAreaCalendar({
  bookings,
  onBookingCancelled,
}: PersonalAreaCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [isMobile,   setIsMobile]   = useState(false);
  const [openMenu,   setOpenMenu]   = useState<OpenMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close menu on outside click (setTimeout 0 prevents the opening click from immediately closing)
  useEffect(() => {
    if (!openMenu) return;
    let active = false;
    const id = setTimeout(() => {
      active = true;
      function onDown(e: MouseEvent) {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          setOpenMenu(null);
        }
      }
      document.addEventListener("mousedown", onDown);
      return () => document.removeEventListener("mousedown", onDown);
    }, 0);
    return () => { clearTimeout(id); };
  }, [openMenu]);

  // Dismiss on scroll (menu position would be stale)
  useEffect(() => {
    if (!openMenu) return;
    const onScroll = () => setOpenMenu(null);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [openMenu]);

  const HALF_H   = isMobile ? 26 : 30;
  const HEADER_H = isMobile ? 52 : 64;

  const allStarts = bookings.map((b) => new Date(b.startsAt).getTime());
  const firstWeek = allStarts.length > 0 ? mondayOf(new Date(Math.min(...allStarts))) : mondayOf(new Date());
  const lastWeek  = allStarts.length > 0 ? mondayOf(new Date(Math.max(...allStarts))) : mondayOf(new Date());
  const maxOffset = Math.round((lastWeek.getTime() - firstWeek.getTime()) / (7 * 86_400_000));

  const weekStart = addWeeks(firstWeek, weekOffset);
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const todayStr = new Date().toDateString();

  const handleBlockOpen = useCallback((booking: UserBooking, rect: DOMRect) => {
    setOpenMenu((prev) =>
      prev?.booking.token === booking.token ? null : { booking, rect }
    );
  }, []);

  const weekLabel = (() => {
    const day   = weekStart.getDate();
    const month = MONTHS_ES[weekStart.getMonth()];
    return `Semana del ${day} de ${month}`;
  })();

  return (
    <>
      <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#1c1b1d", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#4edea3", flexShrink: 0, lineHeight: 1 }}>event_note</span>
            <p style={{ fontFamily: "var(--font-headline, Manrope), sans-serif", fontSize: isMobile ? 15 : 17, fontWeight: 700, color: "#e5e1e4", letterSpacing: "-0.01em", margin: 0, lineHeight: 1.2 }}>
              {weekLabel}
            </p>
          </div>

          {/* Week navigation */}
          <div style={{ display: "flex", alignItems: "center", background: "#0e0e10", borderRadius: 9999, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden", flexShrink: 0 }}>
            <NavBtn dir="prev" disabled={weekOffset === 0}          onClick={() => setWeekOffset((w) => Math.max(0, w - 1))} />
            <NavBtn dir="next" disabled={weekOffset >= maxOffset}   onClick={() => setWeekOffset((w) => Math.min(maxOffset, w + 1))} />
          </div>
        </div>

        {/* Grid */}
        <div style={{ overflowX: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", columnGap: 1, background: "rgba(255,255,255,0.05)" }}>
            <TimeColumn isMobile={isMobile} HALF_H={HALF_H} HEADER_H={HEADER_H} />
            {days.map((day) => (
              <DayColumn
                key={dateKey(day)}
                date={day}
                bookings={bookings}
                isMobile={isMobile}
                isToday={day.toDateString() === todayStr}
                HALF_H={HALF_H}
                HEADER_H={HEADER_H}
                onOpen={handleBlockOpen}
              />
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 12px 14px 64px", background: "#1c1b1d" }}>
          <LegendItem bg="rgba(78,222,163,0.15)" border="rgba(78,222,163,0.4)" label="Sesión individual" />
          <LegendItem bg="rgba(158,210,181,0.15)" border="rgba(158,210,181,0.35)" label="Pack / Inicial" />
        </div>
      </div>

      {/* Context menu — rendered at fixed position, outside overflow containers */}
      {openMenu && (
        <ContextMenu
          ref={menuRef}
          booking={openMenu.booking}
          rect={openMenu.rect}
          onClose={() => setOpenMenu(null)}
          onCancelled={() => { setOpenMenu(null); onBookingCancelled(); }}
        />
      )}

      <style>{`
        @keyframes paBookingPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.68; }
        }
        @keyframes paDotPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1); }
        }
      `}</style>
    </>
  );
}

function NavBtn({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Semana anterior" : "Semana siguiente"}
      style={{
        width: 36, height: 36, background: "transparent",
        border: dir === "next" ? "none" : "none",
        borderLeft: dir === "next" ? "1px solid rgba(255,255,255,0.07)" : "none",
        cursor:  disabled ? "not-allowed" : "pointer",
        color:   disabled ? "rgba(134,148,138,0.3)" : "#bbcabf",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: disabled ? 0.4 : 1, transition: "color 0.12s",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        {dir === "prev"
          ? <polyline points="15 18 9 12 15 6" />
          : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  );
}

function LegendItem({ bg, border, label }: { bg: string; border: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#86948a" }}>
      <span style={{ width: 18, height: 10, borderRadius: 3, background: bg, border: `1px solid ${border}`, display: "inline-block", flexShrink: 0 }} />
      {label}
    </span>
  );
}
