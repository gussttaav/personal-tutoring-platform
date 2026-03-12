"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button, Alert, Card, CreditsPill, Spinner } from "@/components/ui";
import { COLORS } from "@/constants";
import { api, ApiError } from "@/lib/api-client";
import type { StudentInfo } from "@/types";

const CalComBooking = dynamic(() => import("@/components/CalComBooking"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center" style={{ minHeight: "400px" }}>
      <Spinner label="Cargando calendario..." />
      <p className="text-sm mt-2" style={{ color: COLORS.textSecondary }}>
        Cargando calendario...
      </p>
    </div>
  ),
});

type BookingPhase = "idle" | "confirming" | "success" | "error";

interface BookingModeViewProps {
  student: StudentInfo;
  calLink: string;
  onCreditsUpdated: (remaining: number) => void;
  onExit: () => void;
  /** When true the inner credits+exit bar is suppressed — used when the
   *  parent already renders a unified top bar. */
  hideTopBar?: boolean;
}

export default function BookingModeView({
  student,
  calLink,
  onCreditsUpdated,
  onExit,
  hideTopBar = false,
}: BookingModeViewProps) {
  const [phase, setPhase] = useState<BookingPhase>("idle");
  const [remaining, setRemaining] = useState(student.credits);
  const [errMsg, setErrMsg] = useState("");
  const [calKey, setCalKey] = useState(0);

  const handleBookingSuccess = useCallback(async () => {
    setPhase("confirming");
    try {
      const data = await api.book.post(student.email);
      setRemaining(data.remaining);
      setPhase("success");
      onCreditsUpdated(data.remaining);
    } catch (err) {
      setErrMsg(err instanceof ApiError ? err.message : "Error al registrar la reserva.");
      setPhase("error");
    }
  }, [student.email, onCreditsUpdated]);

  function bookAnother() {
    setPhase("idle");
    setCalKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden" style={{ minHeight: "580px" }}>
      {/* Top bar — hidden when parent renders a unified bar */}
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

      {/* Phase: idle */}
      {phase === "idle" && (
        <div className="flex-1">
          <CalComBooking
            key={calKey}
            calLink={calLink}
            userName={student.name}
            userEmail={student.email}
            theme="dark"
            brandColor={COLORS.brand}
            namespace={`booking-${calKey}`}
            onBookingSuccess={handleBookingSuccess}
          />
        </div>
      )}

      {/* Phase: confirming */}
      {phase === "confirming" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ minHeight: "400px" }}>
          <Spinner label="Registrando reserva..." />
          <p className="text-sm" style={{ color: COLORS.textSecondary }}>
            Registrando tu reserva...
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
              aria-hidden="true"
            >
              ✓
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">¡Clase reservada!</h3>
              <p className="mt-1 text-sm" style={{ color: COLORS.textSecondary }}>
                Recibirás una confirmación por email.
              </p>
            </div>

            <Card className="p-4">
              {remaining > 0 ? (
                <>
                  <p className="font-semibold" style={{ color: COLORS.brand }}>
                    Te quedan {remaining} clase{remaining !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                    Reserva cuando quieras antes de que caduque tu pack.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold" style={{ color: COLORS.warning }}>
                    Has usado todas tus clases del pack
                  </p>
                  <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                    Puedes comprar otro pack para seguir reservando.
                  </p>
                </>
              )}
            </Card>

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
              aria-hidden="true"
            >
              ✕
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Algo salió mal</h3>
              <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
                {errMsg}
              </p>
            </div>
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
