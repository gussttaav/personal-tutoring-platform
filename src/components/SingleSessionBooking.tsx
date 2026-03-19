"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Spinner, Alert } from "@/components/ui";
import { COLORS } from "@/constants";
import { api, ApiError } from "@/lib/api-client";
import SlotPicker, { type SelectedSlot } from "@/components/SlotPicker";

export type SingleSessionType = "free15min" | "session1h" | "session2h";

interface SingleSessionBookingProps {
  sessionType: SingleSessionType;
  userName:    string;
  userEmail:   string;
  onBack:      () => void;
}

const SESSION_CONFIG: Record<
  SingleSessionType,
  { label: string; durationMinutes: 15 | 60 | 120 }
> = {
  free15min: { label: "Encuentro inicial · 15 min",  durationMinutes: 15  },
  session1h: { label: "Sesión de 1 hora",             durationMinutes: 60  },
  session2h: { label: "Sesión de 2 horas",            durationMinutes: 120 },
};

type Phase = "picking" | "booking" | "redirecting" | "success" | "error";

export default function SingleSessionBooking({
  sessionType,
  userName,
  userEmail,
  onBack,
}: SingleSessionBookingProps) {
  const router = useRouter();
  const { label, durationMinutes } = SESSION_CONFIG[sessionType];

  const [phase,      setPhase]      = useState<Phase>("picking");
  const [errorMsg,   setErrorMsg]   = useState("");
  const [meetLink,   setMeetLink]   = useState("");
  const [pickedSlot, setPickedSlot] = useState<SelectedSlot | null>(null);

  const handleSlotSelected = useCallback(async (slot: SelectedSlot) => {
    setPickedSlot(slot);

    if (sessionType === "free15min") {
      // Free session — book directly, no payment needed
      setPhase("booking");
      try {
        const res  = await fetch("/api/book", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            startIso:    slot.startIso,
            endIso:      slot.endIso,
            sessionType: "free15min",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new ApiError(data.error ?? "Error al reservar", res.status);
        setMeetLink(data.meetLink ?? "");
        setPhase("success");
      } catch (err) {
        setErrorMsg(err instanceof ApiError ? err.message : "Error al reservar.");
        setPhase("error");
      }
      return;
    }

    // Paid sessions — go to Stripe, then the webhook will create the event
    // For now store the slot in sessionStorage so the Stripe success page can use it
    // Actually: we create the calendar event AFTER payment via the Stripe webhook.
    // Here we just redirect to Stripe with the slot encoded in metadata.
    setPhase("redirecting");
    try {
      const duration = sessionType === "session1h" ? "1h" : "2h";
      const data = await api.stripe.checkoutSingleSession({
        duration,
        // Pass slot info so the webhook can create the event
        startIso: slot.startIso,
        endIso:   slot.endIso,
      });
      window.location.href = data.url;
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "Error al iniciar el pago. Por favor inténtalo de nuevo."
      );
      setPhase("error");
    }
  }, [sessionType]);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "var(--bg)", zIndex: 40,
      overflowY: "auto", display: "flex", flexDirection: "column",
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px",
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0,
        background: "var(--bg)", zIndex: 1,
      }}>
        <span style={{
          fontSize: 13, fontWeight: 500,
          color: "var(--text-muted)",
          letterSpacing: "0.04em", textTransform: "uppercase",
        }}>
          {label}
        </span>
        <button
          onClick={onBack}
          style={{
            fontSize: 13, color: "var(--text-muted)",
            background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
            transition: "color 0.2s", fontFamily: "inherit",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
        >
          ← Volver
        </button>
      </div>

      <div style={{ flex: 1, padding: "8px 24px 40px", maxWidth: 760, margin: "0 auto", width: "100%" }}>

        {/* Phase: picking */}
        {phase === "picking" && (
          <SlotPicker
            durationMinutes={durationMinutes}
            onSlotSelected={handleSlotSelected}
          />
        )}

        {/* Phase: booking (free session) */}
        {phase === "booking" && (
          <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: 400 }}>
            <Spinner />
            <p style={{ color: COLORS.textSecondary, fontSize: 14 }}>
              Reservando {pickedSlot?.dateLabel} a las {pickedSlot?.label}…
            </p>
          </div>
        )}

        {/* Phase: redirecting to Stripe */}
        {phase === "redirecting" && (
          <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: 400 }}>
            <Spinner />
            <p style={{ color: COLORS.textSecondary, fontSize: 14 }}>
              Redirigiendo al pago…
            </p>
          </div>
        )}

        {/* Phase: success (free session) */}
        {phase === "success" && (
          <div className="flex flex-col items-center justify-center gap-6 text-center" style={{ minHeight: 400, maxWidth: 400, margin: "0 auto" }}>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
              style={{ background: COLORS.brandMuted, color: COLORS.brand }}
            >✓</div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
                ¡Encuentro reservado!
              </h2>
              <p style={{ fontSize: 14, color: COLORS.textSecondary }}>
                {pickedSlot?.dateLabel} · {pickedSlot?.label}
              </p>
            </div>

            {meetLink && (
              <a
                href={meetLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "10px 20px", borderRadius: 8,
                  background: "var(--green)", color: "#0d0f10",
                  fontSize: 13, fontWeight: 500, textDecoration: "none",
                }}
              >
                Abrir Google Meet →
              </a>
            )}

            <p style={{ fontSize: 13, color: COLORS.textSecondary }}>
              Recibirás un email de confirmación con el enlace de Google Meet
              y la opción de cancelar si lo necesitas.
            </p>

            <button
              onClick={onBack}
              style={{
                padding: "10px 24px", borderRadius: 8,
                background: "none", border: "1px solid var(--border)",
                color: "var(--text-muted)", fontSize: 13,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Volver al inicio
            </button>
          </div>
        )}

        {/* Phase: error */}
        {phase === "error" && (
          <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: 400, maxWidth: 400, margin: "0 auto" }}>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl"
              style={{ background: COLORS.errorBg, color: COLORS.error }}
            >✕</div>
            <Alert variant="error">{errorMsg}</Alert>
            <button
              onClick={() => setPhase("picking")}
              style={{
                fontSize: 13, color: COLORS.brand,
                background: "none", border: "none",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Intentar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
