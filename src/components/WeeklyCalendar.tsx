"use client";

/**
 * WeeklyCalendar — redesigned slot interaction
 *
 * Desktop: click slot → focused state + "Seleccionar" overlay button → click overlay → opens modal
 * Mobile:  first tap → focused, second tap on same slot → opens modal  (Option A)
 *
 * Timezone: detects user's local timezone, fetches slots with ?tz= param,
 * displays localLabel (user time) alongside Madrid time in the modal.
 */

import { useState, useEffect, useCallback } from "react";
import { SCHEDULE } from "@/lib/booking-config";

export interface SelectedSlot {
  startIso:   string;
  endIso:     string;
  label:      string;
  localLabel: string;
  dateLabel:  string;
  dateShort:  string;
  timezone:   string;
  note?:      string;
}

interface ApiSlot {
  start:      string;
  end:        string;
  label:      string;
  localLabel: string;
}

interface WeeklyCalendarProps {
  durationMinutes:  15 | 60 | 120;
  onSlotSelected:   (slot: SelectedSlot) => void;
  selectedSlot?:    SelectedSlot | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_SHORT   = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_LONG  = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const MONTHS_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getWeekDates(weekOffset: number): Date[] {
  const now = new Date(); now.setHours(0,0,0,0);
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
}

function weekLabel(days: Date[]): string {
  const f = days[0], l = days[6];
  if (f.getMonth() === l.getMonth()) return `${f.getDate()}–${l.getDate()} de ${MONTHS_LONG[f.getMonth()]} ${f.getFullYear()}`;
  return `${f.getDate()} ${MONTHS_SHORT[f.getMonth()]} – ${l.getDate()} ${MONTHS_SHORT[l.getMonth()]} ${l.getFullYear()}`;
}

function formatDateLabel(d: Date): string { return `${DAYS_SHORT[d.getDay()]}, ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`; }
function formatDateShort(d: Date): string { return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; }

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyCalendar({ durationMinutes, onSlotSelected, selectedSlot }: WeeklyCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [slotsMap,   setSlotsMap]   = useState<Record<string, ApiSlot[] | "loading" | "error">>({});
  // The slot that is "focused" (clicked once) but not yet confirmed
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  // The slot data + date for the confirm modal
  const [modalSlot,  setModalSlot]  = useState<{ slot: ApiSlot; date: Date } | null>(null);
  const [isMobile,   setIsMobile]   = useState(false);
  const [userTz,     setUserTz]     = useState<string>(SCHEDULE.timezone);
  const [hasManuallyNavigated, setHasManuallyNavigated] = useState(false);

  const maxOffset = SCHEDULE.bookingWindowWeeks;
  const days      = getWeekDates(weekOffset);
  const today     = new Date(); today.setHours(0,0,0,0);
  const todayYMD  = toYMD(today);
  const maxDate   = new Date(today); maxDate.setDate(today.getDate() + SCHEDULE.bookingWindowWeeks * 7);
  const maxYMD    = toYMD(maxDate);

  // Detect mobile and user timezone once on mount
  useEffect(() => {
    setIsMobile(window.matchMedia("(pointer: coarse)").matches);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setUserTz(tz);
    } catch { /* keep default */ }
  }, []);

  // Auto-advance to next week if current week is completely empty
  useEffect(() => {
    if (hasManuallyNavigated || weekOffset >= maxOffset) return;

    let allLoaded = true;
    let hasAnySlots = false;
    let hasValidDays = false;

    days.forEach((date) => {
      const ymd = toYMD(date);
      if (ymd < todayYMD || ymd > maxYMD) return;

      hasValidDays = true;
      const dayData = slotsMap[ymd];

      if (dayData === undefined || dayData === "loading") {
        allLoaded = false;
      } else if (dayData === "error") {
        hasAnySlots = true; // Prevent auto-advance on error so user can see it
      } else if (Array.isArray(dayData) && dayData.length > 0) {
        hasAnySlots = true;
      }
    });

    if (hasValidDays && allLoaded && !hasAnySlots) {
      setWeekOffset(o => o + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsMap, weekOffset, hasManuallyNavigated]);

  // Fetch availability for the current week
  useEffect(() => {
    days.forEach(async (date) => {
      const ymd = toYMD(date);
      if (ymd < todayYMD || ymd > maxYMD) return;
      if (slotsMap[ymd] !== undefined) return;
      setSlotsMap(prev => ({ ...prev, [ymd]: "loading" }));
      try {
        const res  = await fetch(`/api/availability?date=${ymd}&duration=${durationMinutes}&tz=${encodeURIComponent(userTz)}`);
        const data = await res.json();
        setSlotsMap(prev => ({ ...prev, [ymd]: data.slots ?? [] }));
      } catch {
        setSlotsMap(prev => ({ ...prev, [ymd]: "error" }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, durationMinutes, userTz]);

  // Re-fetch when timezone changes
  useEffect(() => {
    setSlotsMap({});
    setHasManuallyNavigated(false);
    setWeekOffset(0);
  }, [userTz]);

  function slotKey(date: Date, slot: ApiSlot) { return `${toYMD(date)}-${slot.start}`; }

  function handleSlotClick(date: Date, slot: ApiSlot) {
    const key = slotKey(date, slot);
    if (isMobile) {
      // Mobile: first tap focuses, second tap opens modal
      if (focusedKey === key) {
        setModalSlot({ slot, date });
      } else {
        setFocusedKey(key);
      }
    } else {
      // Desktop: click focuses (overlay "Seleccionar" button appears on hover)
      setFocusedKey(prev => prev === key ? null : key);
    }
  }

  function handleSelectOverlay(date: Date, slot: ApiSlot, e: React.MouseEvent) {
    e.stopPropagation();
    setModalSlot({ slot, date });
  }

  function handleModalConfirm(note?: string) {
    if (!modalSlot) return;
    const { slot, date } = modalSlot;
    onSlotSelected({
      startIso:   slot.start,
      endIso:     slot.end,
      label:      slot.label,
      localLabel: slot.localLabel,
      dateLabel:  formatDateLabel(date),
      dateShort:  formatDateShort(date),
      timezone:   userTz,
      note,
    });
    setModalSlot(null);
    setFocusedKey(null);
  }

  function handleModalClose() {
    setModalSlot(null);
    setFocusedKey(null);
  }

  const canPrev = weekOffset > 0;
  const canNext = weekOffset < maxOffset;
  const tzDiffers = userTz !== SCHEDULE.timezone;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{weekLabel(days)}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <NavBtn onClick={() => { setWeekOffset(o => o - 1); setHasManuallyNavigated(true); }} disabled={!canPrev} direction="left" />
              <NavBtn onClick={() => { setWeekOffset(o => o + 1); setHasManuallyNavigated(true); }} disabled={!canNext} direction="right" />
            </div>
          </div>
        </div>

        {/* 7-day grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {days.map((date) => {
            const ymd      = toYMD(date);
            const isPast   = ymd < todayYMD;
            const isBeyond = ymd > maxYMD;
            const isToday  = ymd === todayYMD;
            const daySlots = slotsMap[ymd];

            return (
              <div key={ymd} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: isPast ? 0.35 : 1 }}>
                {/* Day header */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, paddingBottom: 6, borderBottom: "1px solid var(--border)", width: "100%" }}>
                  <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: isToday ? "var(--green)" : "var(--text-dim)" }}>
                    {DAYS_SHORT[date.getDay()]}
                  </span>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, background: isToday ? "var(--surface-2)" : "none", border: isToday ? "1px solid rgba(255,255,255,0.12)" : "none", color: isToday ? "var(--text)" : "var(--text-muted)" }}>
                    {date.getDate()}
                  </div>
                </div>

                {/* Slots */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
                  {isPast || isBeyond ? <EmptyDash /> :
                   daySlots === "loading" || daySlots === undefined ? <LoadingDots /> :
                   daySlots === "error" || daySlots.length === 0 ? <EmptyDash /> :
                   daySlots.map((slot) => {
                     const key        = slotKey(date, slot);
                     const isFocused  = focusedKey === key;
                     const isSelected = selectedSlot?.startIso === slot.start;
                     const displayLabel = tzDiffers ? slot.localLabel : slot.label;
                     return (
                       <SlotButton
                         key={slot.start}
                         label={displayLabel}
                         subLabel={tzDiffers ? slot.label : undefined}
                         focused={isFocused}
                         selected={isSelected}
                         isMobile={isMobile}
                         onClick={() => handleSlotClick(date, slot)}
                         onSelectOverlay={(e) => handleSelectOverlay(date, slot, e)}
                       />
                     );
                   })
                  }
                </div>
              </div>
            );
          })}
        </div>

        {isMobile && focusedKey && (
          <p style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>
            Toca el horario seleccionado de nuevo para confirmar
          </p>
        )}
      </div>

      {/* Confirmation modal */}
      {modalSlot && (
        <ConfirmModal
          slot={modalSlot.slot}
          date={modalSlot.date}
          userTz={userTz}
          onConfirm={handleModalConfirm}
          onClose={handleModalClose}
        />
      )}
    </>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  slot, date, userTz, onConfirm, onClose,
}: {
  slot: ApiSlot; date: Date; userTz: string;
  onConfirm: (note?: string) => void; onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const tzDiffers  = userTz !== SCHEDULE.timezone;
  const dateLabel  = formatDateLabel(date);
  const localLabel = slot.localLabel;
  const madridLabel = slot.label;

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 16, width: "100%", maxWidth: 420,
        padding: "24px",
        display: "flex", flexDirection: "column", gap: 18,
        animation: "fadeUp 0.2s ease both",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(61,220,132,0.1)", border: "1px solid rgba(61,220,132,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3ddc84" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{dateLabel}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {tzDiffers ? `${localLabel} (tu hora)` : localLabel}
                {tzDiffers && <span style={{ color: "var(--text-dim)", marginLeft: 4 }}>· {madridLabel} Madrid</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Note input */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            Motivo de la sesión <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(opcional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Ej: tengo dudas sobre recursividad en Java, preparación de entrevista técnica..."
            style={{
              width: "100%", padding: "10px 12px",
              background: "var(--surface-2, #1c1f21)",
              border: "1px solid var(--border)",
              borderRadius: 8, color: "var(--text)",
              fontFamily: "inherit", fontSize: 13, lineHeight: 1.6,
              resize: "vertical", outline: "none",
              transition: "border-color 0.15s",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(61,220,132,0.4)")}
            onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
          />
          <p style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 5 }}>
            También puedes enviar los detalles por email después
          </p>
        </div>

        {/* Confirm button */}
        <button
          onClick={() => onConfirm(note || undefined)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            width: "100%", padding: "13px 20px",
            background: "var(--green)", border: "none", borderRadius: 8,
            color: "#0d0f10", fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#5ae89a")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--green)")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Confirmar reserva
        </button>

        <p style={{ fontSize: 11.5, color: "var(--text-dim)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, margin: 0 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Recibirás confirmación por correo
        </p>
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}

// ─── Slot button ─────────────────────────────────────────────────────────────

function SlotButton({ label, subLabel, focused, selected, isMobile, onClick, onSelectOverlay }: {
  label: string; subLabel?: string;
  focused: boolean; selected: boolean; isMobile: boolean;
  onClick: () => void;
  onSelectOverlay: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const showOverlay = focused && (hovered || isMobile);

  return (
    <div style={{ position: "relative", width: "100%" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <button
        onClick={onClick}
        style={{
          width: "100%", padding: subLabel ? "4px 2px" : "6px 2px",
          borderRadius: 8, fontSize: 11, fontWeight: focused || selected ? 600 : 500,
          cursor: "pointer", textAlign: "center",
          border: selected ? "1px solid var(--green)" :
                  focused  ? "1px solid rgba(61,220,132,0.6)" :
                             "1px solid rgba(61,220,132,0.2)",
          background: selected ? "var(--green)" :
                      focused  ? "rgba(61,220,132,0.18)" :
                                 "rgba(61,220,132,0.1)",
          color: selected ? "#0d0f10" : "var(--green)",
          fontFamily: "inherit", lineHeight: 1.3,
          transition: "background 0.15s, border-color 0.15s",
          boxShadow: selected ? "0 4px 16px rgba(61,220,132,0.3)" :
                     focused  ? "0 2px 8px rgba(61,220,132,0.15)" : "none",
          filter: focused && !selected ? "brightness(1.1)" : "none",
        }}
      >
        {label}
        {subLabel && <div style={{ fontSize: 9, opacity: 0.6, lineHeight: 1.2 }}>{subLabel}</div>}
      </button>

      {/* Overlay "Seleccionar" button — appears on hover when focused */}
      {focused && !selected && (
        <button
          onClick={onSelectOverlay}
          style={{
            position: "absolute", inset: 0,
            borderRadius: 8, border: "none",
            background: hovered ? "rgba(61,220,132,0.92)" : "rgba(61,220,132,0.0)",
            color: "#0d0f10",
            fontSize: 10, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            transition: "background 0.18s, opacity 0.18s",
            opacity: hovered ? 1 : 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          aria-label="Seleccionar este horario"
        >
          ✓ Seleccionar
        </button>
      )}
    </div>
  );
}

// ─── Nav button ───────────────────────────────────────────────────────────────

function NavBtn({ onClick, disabled, direction }: { onClick: () => void; disabled: boolean; direction: "left" | "right" }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={direction === "left" ? "Semana anterior" : "Semana siguiente"}
      style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", cursor: disabled ? "not-allowed" : "pointer", color: "var(--text-muted)", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", opacity: disabled ? 0.3 : 1, transition: "border-color 0.15s, color 0.15s" }}
      onMouseEnter={(e) => { if (!disabled) { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)"; (e.currentTarget as HTMLElement).style.color = "var(--text)"; } }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
    >
      {direction === "left"
        ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      }
    </button>
  );
}

function EmptyDash() {
  return <div style={{ width: "100%", height: 36, borderRadius: 8, background: "var(--surface)", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 14, height: 1, background: "var(--text-dim)" }} /></div>;
}

function LoadingDots() {
  return (
    <div style={{ width: "100%", height: 36, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
      {[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--text-dim)", animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
      <style>{`@keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}
