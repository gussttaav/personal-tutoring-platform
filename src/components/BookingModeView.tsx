"use client";

import { useState, useCallback } from "react";
import { Button, Alert, CreditsPill, Spinner } from "@/components/ui";
import { COLORS } from "@/constants";
import { ApiError } from "@/lib/api-client";
import SlotPicker, { type SelectedSlot } from "@/components/SlotPicker";
import type { StudentInfo } from "@/types";

type BookingPhase = "idle" | "confirming" | "success" | "error";

interface BookingModeViewProps {
  student: StudentInfo;
  onCreditsUpdated: (remaining: number) => void;
  onExit: () => void;
  hideTopBar?: boolean;
}

export default function BookingModeView({
  student,
  onCreditsUpdated,
  onExit,
  hideTopBar = false,
}: BookingModeViewProps) {
  const [phase,     setPhase]     = useState<BookingPhase>("idle");
  const [remaining, setRemaining] = useState(student.credits);
  const [errMsg,    setErrMsg]    = useState("");
  const [meetLink,  setMeetLink]  = useState("");
  const [pickedSlot, setPickedSlot] = useState<SelectedSlot | null>(null);

  const handleSlotSelected = useCallback(async (slot: SelectedSlot) => {
    setPickedSlot(slot);
    setPhase("confirming");

    try {
      const res = await fetch("/api/book", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          startIso:    slot.startIso,
          endIso:      slot.endIso,
          sessionType: "pack",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new ApiError(data.error ?? "Error al reservar", res.status);

      // Update remaining credits from KV (returned implicitly via credits endpoint)
      const credRes  = await fetch("/api/credits");
      const credData = await credRes.json();
      const newRemaining = credData.credits ?? (remaining - 1);

      setRemaining(newRemaining);
      setMeetLink(data.meetLink ?? "");
      setPhase("success");
      onCreditsUpdated(newRemaining);
    } catch (err) {
      setErrMsg(err instanceof ApiError ? err.message : "Error al registrar la reserva.");
      setPhase("error");
    }
  }, [remaining, onCreditsUpdated]);

  function bookAnother() {
    setPhase("idle");
    setPickedSlot(null);
    setMeetLink("");
  }

  return (
    <div className="flex flex-col" style={{ minHeight: 580 }}>
      {/* Top bar */}
      {!hideTopBar && (
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b"
          style={{ borderColor: COLORS.border }}
        >
          <CreditsPill credits={remaining} />
          <button
            onClick={onExit}
            className="text-xs transition-colors"
            style={{ color: COLORS.textMuted }}
            onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.textSecondary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.textMuted)}
          >
            ← Volver al inicio
          </button>
        </div>
      )}

      {/* Phase: idle — show slot picker */}
      {phase === "idle" && (
        <div style={{ padding: "8px 20px 24px" }}>
          <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 4 }}>
            Tienes <strong style={{ color: "var(--green)" }}>{remaining} clase{remaining !== 1 ? "s" : ""}</strong> disponible{remaining !== 1 ? "s" : ""}.
            Elige día y hora:
          </p>
          <SlotPicker durationMinutes={60} onSlotSelected={handleSlotSelected} />
        </div>
      )}

      {/* Phase: confirming */}
      {phase === "confirming" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ minHeight: 400 }}>
          <Spinner />
          <p style={{ fontSize: 13, color: COLORS.textSecondary }}>
            Reservando {pickedSlot?.dateLabel} a las {pickedSlot?.label}…
          </p>
        </div>
      )}

      {/* Phase: success */}
      {phase === "success" && (
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
          <div className="text-center space-y-6 max-w-sm w-full">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl"
              style={{ backgroundColor: COLORS.brandMuted, color: COLORS.brand }}
            >✓</div>

            <div>
              <h3 className="text-xl font-bold text-white">¡Clase reservada!</h3>
              <p className="mt-1 text-sm" style={{ color: COLORS.textSecondary }}>
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

            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              {remaining > 0 ? (
                <>
                  <p className="font-semibold" style={{ color: COLORS.brand }}>
                    Te quedan {remaining} clase{remaining !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                    Recibirás el enlace de cancelación por email.
                  </p>
                </>
              ) : (
                <p className="font-semibold" style={{ color: COLORS.warning }}>
                  Has usado todas tus clases del pack
                </p>
              )}
            </div>

            <div className="space-y-3">
              {remaining > 0 && (
                <Button variant="primary" fullWidth onClick={bookAnother}>
                  Reservar otra clase
                </Button>
              )}
              <Button variant="secondary" fullWidth onClick={onExit}>
                {remaining > 0 ? "Volver al inicio" : "Comprar otro pack"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Phase: error */}
      {phase === "error" && (
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
          <div className="text-center space-y-4 max-w-sm w-full">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto text-xl"
              style={{ backgroundColor: COLORS.errorBg, color: COLORS.error }}
            >✕</div>
            <h3 className="text-lg font-bold text-white">Algo salió mal</h3>
            <Alert variant="error">{errMsg}</Alert>
            <Button variant="primary" fullWidth onClick={() => setPhase("idle")}>
              Intentar de nuevo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
