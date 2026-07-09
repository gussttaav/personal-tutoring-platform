/**
 * Admin form to edit the booking schedule: per-day working hours with split
 * shifts, minimum advance notice, and timezone. POSTs to /api/admin/schedule and
 * reloads on success. Admin panel is Spanish.
 *
 * Time dropdowns use 15-minute granularity so existing values like 13:45 / 15:15
 * are representable. A day with its checkbox off (or no blocks) is non-working.
 */
"use client";

import { useState } from "react";
import type { ScheduleConfig, TimeBlock } from "@/domain/types";
import { SUPPORTED_TIMEZONES } from "@/lib/timezones";

// Monday-first display order; values are JS day-of-week (0=Sun..6=Sat).
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  0: "Domingo",
};

const STEP = 15;
const DEFAULT_BLOCK: TimeBlock = { startMinute: 540, endMinute: 810 }; // 09:00–13:30

/** Minutes since midnight → "HH:MM" (1440 → "24:00"). */
function minutesToLabel(m: number): string {
  const h  = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// All selectable times at 15-min steps, 00:00 … 24:00.
const TIME_OPTIONS: { value: number; label: string }[] = [];
for (let m = 0; m <= 1440; m += STEP) {
  TIME_OPTIONS.push({ value: m, label: minutesToLabel(m) });
}

interface DayState {
  enabled: boolean;
  blocks:  TimeBlock[];
}

type WeekState = Record<number, DayState>;

function initState(config: ScheduleConfig): WeekState {
  const state = {} as WeekState;
  for (const dow of DISPLAY_ORDER) {
    const blocks = config.weeklyHours[dow] ?? [];
    state[dow] = {
      enabled: blocks.length > 0,
      blocks:  blocks.length > 0 ? blocks.map((b) => ({ ...b })) : [{ ...DEFAULT_BLOCK }],
    };
  }
  return state;
}

export function ScheduleForm({ config }: { config: ScheduleConfig }) {
  const [week, setWeek]                 = useState<WeekState>(() => initState(config));
  const [timezone, setTimezone]         = useState(config.timezone);
  const [minNotice, setMinNotice]       = useState(String(config.minNoticeHours));
  const [reason, setReason]             = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  function toggleDay(dow: number) {
    setWeek((w) => ({ ...w, [dow]: { ...w[dow]!, enabled: !w[dow]!.enabled } }));
  }

  function setBlock(dow: number, idx: number, patch: Partial<TimeBlock>) {
    setWeek((w) => {
      const blocks = w[dow]!.blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b));
      return { ...w, [dow]: { ...w[dow]!, blocks } };
    });
  }

  function addBlock(dow: number) {
    setWeek((w) => {
      const blocks = [...w[dow]!.blocks, { ...DEFAULT_BLOCK }];
      return { ...w, [dow]: { ...w[dow]!, blocks } };
    });
  }

  function removeBlock(dow: number, idx: number) {
    setWeek((w) => {
      const blocks = w[dow]!.blocks.filter((_, i) => i !== idx);
      return { ...w, [dow]: { ...w[dow]!, blocks } };
    });
  }

  function validate(): { weeklyHours: Record<string, TimeBlock[]> } | null {
    const weeklyHours: Record<string, TimeBlock[]> = {};
    for (const dow of DISPLAY_ORDER) {
      const day = week[dow]!;
      if (!day.enabled || day.blocks.length === 0) {
        weeklyHours[String(dow)] = [];
        continue;
      }
      // Validate each block, then sorted overlap/adjacency.
      for (const b of day.blocks) {
        if (b.endMinute <= b.startMinute) {
          setError(`${DAY_LABELS[dow]}: la hora de fin debe ser posterior a la de inicio.`);
          return null;
        }
      }
      const sorted = [...day.blocks].sort((a, b) => a.startMinute - b.startMinute);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i]!.startMinute <= sorted[i - 1]!.endMinute) {
          setError(`${DAY_LABELS[dow]}: los tramos se solapan o están pegados. Únelos en uno solo.`);
          return null;
        }
      }
      weeklyHours[String(dow)] = sorted;
    }
    return { weeklyHours };
  }

  async function submit() {
    setError(null);

    if (!reason.trim()) {
      setError("La razón es obligatoria.");
      return;
    }

    const notice = parseInt(minNotice, 10);
    if (!Number.isInteger(notice) || notice < 0 || notice > 168) {
      setError("La antelación mínima debe ser un número de horas entre 0 y 168.");
      return;
    }

    const validated = validate();
    if (!validated) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weeklyHours:    validated.weeklyHours,
          timezone,
          minNoticeHours: notice,
          reason:         reason.trim(),
        }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Error al guardar el horario.");
      }
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="adjust-form">
      <div className="adjust-form-head">
        <span className="material-symbols-outlined">schedule</span>
        <h3>Horario de trabajo</h3>
        <span className="adjust-form-hint">Se registra en el historial</span>
      </div>

      <div className="schedule-days">
        {DISPLAY_ORDER.map((dow) => {
          const day = week[dow]!;
          return (
            <div key={dow} className="schedule-day" style={{ opacity: day.enabled ? 1 : 0.55 }}>
              <label className="schedule-day-toggle">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={() => toggleDay(dow)}
                />
                <span>{DAY_LABELS[dow]}</span>
              </label>

              {day.enabled ? (
                <div className="schedule-blocks">
                  {day.blocks.map((block, idx) => (
                    <div key={idx} className="schedule-block">
                      <select
                        value={block.startMinute}
                        onChange={(e) => setBlock(dow, idx, { startMinute: Number(e.target.value) })}
                        aria-label={`${DAY_LABELS[dow]} — inicio tramo ${idx + 1}`}
                      >
                        {TIME_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <span className="schedule-block-sep">a</span>
                      <select
                        value={block.endMinute}
                        onChange={(e) => setBlock(dow, idx, { endMinute: Number(e.target.value) })}
                        aria-label={`${DAY_LABELS[dow]} — fin tramo ${idx + 1}`}
                      >
                        {TIME_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      {day.blocks.length > 1 && (
                        <button
                          type="button"
                          className="schedule-icon-btn"
                          onClick={() => removeBlock(dow, idx)}
                          aria-label="Eliminar tramo"
                          title="Eliminar tramo"
                        >
                          <span className="material-symbols-outlined">close</span>
                        </button>
                      )}
                      {idx === day.blocks.length - 1 && (
                        <button
                          type="button"
                          className="schedule-icon-btn"
                          onClick={() => addBlock(dow)}
                          aria-label="Añadir tramo"
                          title="Añadir tramo"
                        >
                          <span className="material-symbols-outlined">add</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="schedule-day-off">No laborable</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="schedule-settings">
        <label className="schedule-setting">
          <span>Antelación mínima (horas)</span>
          <input
            type="number"
            min="0"
            max="168"
            step="1"
            value={minNotice}
            onChange={(e) => setMinNotice(e.target.value)}
          />
        </label>
        <label className="schedule-setting">
          <span>Zona horaria</span>
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {SUPPORTED_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="adjust-form-row">
        <input
          className="adjust-reason"
          type="text"
          placeholder="Razón — ej: Nuevo horario de verano"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button className="btn-primary" onClick={submit} disabled={loading}>
          {loading ? "Guardando…" : "Guardar"}
        </button>
      </div>

      {error && <p className="adjust-form-error">{error}</p>}
    </div>
  );
}
