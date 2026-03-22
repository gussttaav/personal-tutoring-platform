"use client";

/**
 * BookingModeView — Pack class booking
 *
 * Layout: topbar / sidebar (pack status + session info) / weekly calendar + confirm panel
 *
 * Applied UX improvements (Week 5):
 *
 * UX-02 — Two-phase slot confirmation:
 *   Previously selecting a slot immediately fired the POST /api/book request.
 *   There was no confirmation step — a mis-tap on mobile would charge a credit
 *   without the student intending to book. Now selecting a slot moves to
 *   "selected" phase showing a ConfirmPanel; the student must explicitly press
 *   "Confirmar reserva" to trigger the API call. The "confirming" phase (spinner
 *   during the in-flight request) is now separate from "selected".
 *
 * UX-03 — User-friendly error messages:
 *   HTTP status codes are now mapped to actionable Spanish messages via
 *   friendlyError() from @/constants/errors. "Error al registrar la reserva."
 *   is gone; the user now sees context-specific guidance.
 *
 * UX-05 — Cancel link on success screen:
 *   When the API returns a cancelToken, the success screen now shows a direct
 *   "Cancelar reserva" link alongside the email confirmation note. Students who
 *   need to cancel immediately no longer have to wait for an email that may be
 *   delayed or filtered.
 *
 * All Week 2 fixes are carried forward:
 *   - api.book.post() typed API client (ARCH-04)
 *   - hideTopBar implemented in FullScreenShell (bug fix)
 *   - unused Button/CreditsPill imports removed
 *   - cancelToken state removed (re-added here as UX-05 requires it)
 */

import { useState, useCallback } from "react";
import Image from "next/image";
import { Alert, Spinner } from "@/components/ui";
import { COLORS } from "@/constants";
import { friendlyError } from "@/constants/errors";
import { api, ApiError } from "@/lib/api-client";
import WeeklyCalendar, { type SelectedSlot } from "@/components/WeeklyCalendar";
import type { StudentInfo } from "@/types";

// UX-02: "selected" is a new phase between "idle" and "confirming"
type BookingPhase = "idle" | "selected" | "confirming" | "success" | "error";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

interface BookingModeViewProps {
  student: StudentInfo;
  rescheduleToken?: string | null;
  onCreditsUpdated: (remaining: number) => void;
  onExit: () => void;
  hideTopBar?: boolean;
}

export default function BookingModeView({
  student,
  rescheduleToken,
  onCreditsUpdated,
  onExit,
  hideTopBar = false,
}: BookingModeViewProps) {
  const [phase,       setPhase]       = useState<BookingPhase>("idle");
  const [remaining,   setRemaining]   = useState(student.credits);
  const [errMsg,      setErrMsg]      = useState("");
  const [meetLink,    setMeetLink]    = useState("");
  const [cancelToken, setCancelToken] = useState(""); // UX-05: store for cancel link
  const [selected,    setSelected]    = useState<SelectedSlot | null>(null);
  const [emailFailed, setEmailFailed] = useState(false);

  // UX-02: Step 1 — slot selected → show confirm panel (no API call yet)
  const handleSlotSelected = useCallback((slot: SelectedSlot) => {
    setSelected(slot);
    setPhase("selected");
  }, []);

  // UX-02: Step 2 — user clicks "Confirmar reserva" → fire the API call
  const handleConfirm = useCallback(async () => {
    if (!selected) return;
    setPhase("confirming");

    try {
      const data = await api.book.post({
        startIso:        selected.startIso,
        endIso:          selected.endIso,
        sessionType:     "pack",
        note:            selected.note,
        timezone:        selected.timezone,
        rescheduleToken: rescheduleToken ?? undefined,
      });

      const newRemaining = remaining - 1;
      setRemaining(newRemaining);
      setMeetLink(data.meetLink);
      setCancelToken(data.cancelToken); // UX-05
      setEmailFailed(data.emailFailed);
      setPhase("success");
      onCreditsUpdated(newRemaining);
    } catch (err) {
      // UX-03: map status code to friendly message
      const status = err instanceof ApiError ? err.status : 0;
      const raw    = err instanceof ApiError ? err.message : "Error al registrar la reserva.";
      setErrMsg(friendlyError(status, raw));
      setPhase("error");
    }
  }, [selected, remaining, rescheduleToken, onCreditsUpdated]);

  function bookAnother() {
    setPhase("idle");
    setSelected(null);
    setMeetLink("");
    setCancelToken("");
    setEmailFailed(false);
  }

  // UX-05: build the direct cancel URL from the token
  const cancelUrl = cancelToken ? `${BASE_URL}/cancelar?token=${cancelToken}` : null;

  // ── Success screen ──────────────────────────────────────────────────────────
  if (phase === "success") {
    return (
      <FullScreenShell onBack={onExit} badgeType="pack" badgeLabel="Pack activo" title="Reservar clase del pack" hideTopBar={hideTopBar}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 24px" }}>
          <div style={{ textAlign: "center", maxWidth: 380, width: "100%" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 20px", background: "rgba(61,220,132,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "var(--green)" }}>✓</div>

            <h2 style={{ fontSize: 22, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>¡Clase reservada!</h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
              {selected?.dateLabel} · {selected?.label}
            </p>

            {emailFailed ? (
              <div style={{ background: "rgba(61,220,132,0.08)", border: "1px solid rgba(61,220,132,0.25)", borderRadius: 12, padding: "16px 20px", marginBottom: 20, textAlign: "left" }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--green)", marginBottom: 8 }}>⚠️ No pudimos enviarte el email de confirmación</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Tu clase está reservada. Guarda el enlace de Google Meet ahora:</p>
                <a href={meetLink} target="_blank" rel="noopener noreferrer" style={{ display: "block", wordBreak: "break-all", fontSize: 13, color: "var(--green)", textDecoration: "underline", marginBottom: 8 }}>
                  {meetLink}
                </a>
                {/* UX-05: cancel link even when email failed */}
                {cancelUrl && (
                  <a href={cancelUrl} style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    Cancelar esta reserva
                  </a>
                )}
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
                  Recibirás el enlace de Google Meet y la confirmación por email.
                </p>
                {/* UX-05: direct cancel link — useful if email is delayed or filtered */}
                {cancelUrl && (
                  <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 20 }}>
                    También puedes{" "}
                    <a href={cancelUrl} style={{ color: "var(--text-muted)", textDecoration: "underline" }}>
                      cancelar esta reserva
                    </a>
                    {" "}directamente.
                  </p>
                )}
              </>
            )}

            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", marginBottom: 20, textAlign: "left" }}>
              {remaining > 0 ? (
                <>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "var(--green)", marginBottom: 4 }}>
                    Te quedan {remaining} clase{remaining !== 1 ? "s" : ""}
                  </p>
                  {!emailFailed && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Recibirás el enlace de cancelación por email.
                    </p>
                  )}
                </>
              ) : (
                <p style={{ fontSize: 14, fontWeight: 500, color: COLORS.warning }}>Has usado todas tus clases del pack</p>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {remaining > 0 && <button onClick={bookAnother} style={primaryBtnStyle}>Reservar otra clase</button>}
              <button onClick={onExit} style={secondaryBtnStyle}>
                {remaining > 0 ? "Volver al inicio" : "Comprar otro pack"}
              </button>
            </div>
          </div>
        </div>
      </FullScreenShell>
    );
  }

  // ── Error screen ───────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <FullScreenShell onBack={onExit} badgeType="pack" badgeLabel="Pack activo" title="Reservar clase del pack" hideTopBar={hideTopBar}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, padding: 40 }}>
          <div style={{ textAlign: "center", maxWidth: 380, width: "100%" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", margin: "0 auto 16px", background: COLORS.errorBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: COLORS.error }}>✕</div>
            <h3 style={{ fontSize: 18, color: "var(--text)", marginBottom: 8 }}>Algo salió mal</h3>
            <Alert variant="error">{errMsg}</Alert>
            <button onClick={() => setPhase("idle")} style={{ ...primaryBtnStyle, marginTop: 16 }}>Intentar de nuevo</button>
          </div>
        </div>
      </FullScreenShell>
    );
  }

  // ── Main booking UI (idle + selected + confirming) ─────────────────────────
  return (
    <FullScreenShell onBack={onExit} badgeType="pack" badgeLabel="Pack activo" title="Reservar clase del pack" hideTopBar={hideTopBar}>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", flex: 1, minHeight: 0 }} className="booking-split">

        {/* ── Sidebar ── */}
        <div style={{ borderRight: "1px solid var(--border)", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
          <TutorRow />

          <div style={{ background: "rgba(99,179,237,0.07)", border: "1px solid rgba(99,179,237,0.2)", borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#63b3ed" }}>Pack activo</span>
            <div>
              <div style={{ fontFamily: "var(--font-serif), serif", fontSize: 34, color: "var(--text)", lineHeight: 1 }}>{remaining}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>clase{remaining !== 1 ? "s" : ""} restante{remaining !== 1 ? "s" : ""}</div>
            </div>
            <div style={{ height: 4, background: "var(--surface-3, #222527)", borderRadius: 100, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 100, background: "linear-gradient(90deg, #63b3ed, #3ddc84)", width: `${Math.min(100, (remaining / Math.max(remaining, student.credits)) * 100)}%`, transition: "width 0.4s ease" }} />
            </div>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: "var(--font-serif), serif", fontSize: 20, color: "var(--text)", lineHeight: 1.2 }}>Sesión de 1 hora</div>
            <div style={{ height: 1, background: "var(--border)" }} />
            <InfoRow icon="clock">60 minutos</InfoRow>
            <InfoRow icon="phone">Google Meet</InfoRow>
            <div style={{ height: 1, background: "var(--border)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--green)", fontWeight: 500 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3ddc84" strokeWidth="1.8" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              Incluida en tu pack
            </div>
          </div>

          <MetaRows />
        </div>

        {/* ── Calendar / confirm area ── */}
        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
          {phase === "confirming" ? (
            // In-flight request spinner
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 12 }}>
              <Spinner />
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Reservando {selected?.dateLabel} a las {selected?.label}…
              </p>
            </div>
          ) : phase === "selected" && selected ? (
            // UX-02: Confirmation step — slot chosen, waiting for user to confirm
            <ConfirmPanel
              slot={selected}
              onConfirm={handleConfirm}
              onCancel={() => setPhase("idle")}
              packInfo={{ remaining }}
            />
          ) : (
            // Default: calendar
            <WeeklyCalendar
              durationMinutes={60}
              onSlotSelected={handleSlotSelected}
              selectedSlot={selected}
            />
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .booking-split { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </FullScreenShell>
  );
}

// ─── Exported shells & configs (used by SingleSessionBooking) ─────────────────

export interface SessionConfig {
  type: "free15min" | "session1h" | "session2h";
  label:           string;
  duration:        string;
  price:           string | null;
  durationMinutes: 15 | 60 | 120;
}

export const SESSION_CONFIGS: Record<string, SessionConfig> = {
  free15min: { type: "free15min", label: "Encuentro · 15 min",  duration: "15 minutos",  price: null,  durationMinutes: 15  },
  session1h: { type: "session1h", label: "Sesión · 1 hora",     duration: "60 minutos",  price: "€16", durationMinutes: 60  },
  session2h: { type: "session2h", label: "Sesión · 2 horas",    duration: "120 minutos", price: "€30", durationMinutes: 120 },
};

// ─── FullScreenShell ──────────────────────────────────────────────────────────

export function FullScreenShell({
  children, onBack, badgeType, badgeLabel, title, hideTopBar = false,
}: {
  children:   React.ReactNode;
  onBack:     () => void;
  badgeType:  "free" | "paid" | "pack";
  badgeLabel: string;
  title:      string;
  hideTopBar?: boolean;
}) {
  const badgeColors = {
    free: { bg: "rgba(61,220,132,0.1)",  border: "rgba(61,220,132,0.2)",  color: "var(--green)" },
    paid: { bg: "var(--surface-2, #1c1f21)", border: "var(--border)",     color: "var(--text-muted)" },
    pack: { bg: "rgba(99,179,237,0.1)",  border: "rgba(99,179,237,0.25)", color: "#63b3ed" },
  }[badgeType];

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", zIndex: 40, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      {!hideTopBar && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--border)", background: "rgba(13,15,16,0.85)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} aria-label="Volver" style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 0.2s, color 0.2s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)"; (e.currentTarget as HTMLElement).style.color = "var(--text)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{title}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Elige un día y hora disponible</div>
          </div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 100, fontSize: 11.5, fontWeight: 500, background: badgeColors.bg, border: `1px solid ${badgeColors.border}`, color: badgeColors.color }}>
          {badgeLabel}
        </span>
      </div>}

      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>{children}</div>
    </div>
  );
}

// ─── ConfirmPanel ─────────────────────────────────────────────────────────────

export function ConfirmPanel({
  slot, onConfirm, onCancel, packInfo, sessionDuration,
}: {
  slot:             SelectedSlot;
  onConfirm:        () => void;
  onCancel?:        () => void;
  packInfo?:        { remaining: number };
  sessionDuration?: string;
}) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.25s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(61,220,132,0.1)", border: "1px solid rgba(61,220,132,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3ddc84" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{slot.dateLabel} · {slot.label}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{sessionDuration ?? "60 minutos"} · Google Meet</div>
        </div>
      </div>

      {packInfo && (
        <div style={{ background: "rgba(61,220,132,0.1)", border: "1px solid rgba(61,220,132,0.2)", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--green)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3ddc84" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <div>
            Se descontará <strong>1 clase</strong> de tu pack.
            <br />
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
              Te quedarán {Math.max(0, packInfo.remaining - 1)} clase{packInfo.remaining - 1 !== 1 ? "s" : ""} disponible{packInfo.remaining - 1 !== 1 ? "s" : ""}.
            </span>
          </div>
        </div>
      )}

      <button onClick={onConfirm} style={primaryBtnStyle}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#5ae89a"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--green)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        Confirmar reserva
      </button>

      {onCancel && (
        <button onClick={onCancel} style={secondaryBtnStyle}>Elegir otro horario</button>
      )}

      <div style={{ fontSize: 11.5, color: "var(--text-dim)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        Recibirás confirmación por correo
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ─── Shared sidebar atoms ─────────────────────────────────────────────────────

export function TutorRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--surface-2, #1c1f21)", border: "2px solid var(--border)", overflow: "hidden", flexShrink: 0 }}>
        <Image src="/avatar.jpg" alt="Gustavo Torres" width={42} height={42} style={{ objectFit: "cover" }} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>Gustavo Torres Guerrero</div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Profesor & Consultor</div>
      </div>
    </div>
  );
}

export function InfoRow({ icon, children }: { icon: "clock" | "phone"; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
      {icon === "clock" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
      {icon === "phone" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.46a19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 15.92z"/></svg>}
      {children}
    </div>
  );
}

export function MetaRows() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Horarios en tiempo real
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Pago seguro con Stripe
      </div>
    </div>
  );
}

// ─── Button styles ────────────────────────────────────────────────────────────

export const primaryBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  width: "100%", padding: "13px 20px",
  background: "var(--green)", border: "none", borderRadius: 8,
  color: "#0d0f10", fontSize: 14, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit",
  transition: "background 0.15s, transform 0.1s",
};

export const secondaryBtnStyle: React.CSSProperties = {
  width: "100%", padding: "11px",
  background: "none", border: "1px solid var(--border)",
  borderRadius: 8, color: "var(--text-muted)",
  fontSize: 14, cursor: "pointer", fontFamily: "inherit",
  transition: "border-color 0.15s",
};
