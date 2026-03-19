"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { COLORS } from "@/constants";
import { Spinner } from "@/components/ui";

type PageState = "loading" | "confirm" | "processing" | "success" | "error";

function CancelarContent() {
  const params  = useSearchParams();
  const router  = useRouter();
  const token   = params.get("token");

  const [state,        setState]        = useState<PageState>(token ? "confirm" : "error");
  const [errorMsg,     setErrorMsg]     = useState(token ? "" : "Enlace de cancelación inválido.");
  const [sessionLabel, setSessionLabel] = useState("");
  const [creditsBack,  setCreditsBack]  = useState(false);

  async function handleConfirm() {
    setState("processing");
    try {
      const res  = await fetch("/api/cancel", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Error al procesar la cancelación.");
        setState("error");
        return;
      }

      setSessionLabel(data.sessionLabel);
      setCreditsBack(data.creditsRestored);
      setState("success");
    } catch {
      setErrorMsg("Error de conexión. Inténtalo de nuevo.");
      setState("error");
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: COLORS.background }}
    >
      <div
        className="rounded-2xl p-8 sm:p-10 max-w-md w-full space-y-6"
        style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
      >
        {/* ── Confirm ── */}
        {state === "confirm" && (
          <>
            <div className="text-center space-y-2">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto text-2xl"
                style={{ background: COLORS.warningBg, color: COLORS.warning }}
                aria-hidden="true"
              >
                ↩
              </div>
              <h1 className="text-xl font-bold" style={{ color: COLORS.textPrimary }}>
                Cancelar reserva
              </h1>
              <p className="text-sm" style={{ color: COLORS.textSecondary }}>
                ¿Confirmas que quieres cancelar esta sesión? Esta acción no se puede deshacer.
              </p>
            </div>

            <div
              className="rounded-xl p-4 text-sm"
              style={{ background: COLORS.background, border: `1px solid ${COLORS.border}` }}
            >
              <p style={{ color: COLORS.textSecondary, margin: 0 }}>
                Si tienes clases de pack, el crédito se devolverá automáticamente.
                Para sesiones individuales pagadas, Gustavo tramitará el reembolso en 1–3 días hábiles.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => router.push("/")}
                style={{
                  flex: 1, padding: "11px", borderRadius: 8,
                  background: "none", border: `1px solid ${COLORS.border}`,
                  color: COLORS.textMuted, fontSize: 14, cursor: "pointer",
                  fontFamily: "inherit", transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = COLORS.border)}
              >
                Mantener reserva
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  flex: 1, padding: "11px", borderRadius: 8,
                  background: COLORS.error, border: "none",
                  color: "#fff", fontSize: 14, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Sí, cancelar
              </button>
            </div>
          </>
        )}

        {/* ── Processing ── */}
        {state === "processing" && (
          <div className="text-center space-y-4">
            <Spinner />
            <p className="text-sm" style={{ color: COLORS.textSecondary }}>
              Procesando cancelación…
            </p>
          </div>
        )}

        {/* ── Success ── */}
        {state === "success" && (
          <>
            <div className="text-center space-y-2">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto text-2xl"
                style={{ background: COLORS.brandMuted, color: COLORS.brand }}
                aria-hidden="true"
              >
                ✓
              </div>
              <h1 className="text-xl font-bold" style={{ color: COLORS.textPrimary }}>
                Reserva cancelada
              </h1>
              <p className="text-sm" style={{ color: COLORS.textSecondary }}>
                {sessionLabel && `Tu ${sessionLabel.toLowerCase()} ha sido cancelada.`}
              </p>
            </div>

            {creditsBack && (
              <div
                className="rounded-xl p-4 text-sm text-center"
                style={{
                  background: COLORS.successBg,
                  border: `1px solid ${COLORS.successBorder}`,
                }}
              >
                <p style={{ color: COLORS.brand, margin: 0, fontWeight: 500 }}>
                  ✓ Tu crédito ha sido devuelto al pack
                </p>
                <p style={{ color: COLORS.textSecondary, margin: "4px 0 0", fontSize: 12 }}>
                  Puedes reservar otra clase cuando quieras.
                </p>
              </div>
            )}

            <p className="text-sm text-center" style={{ color: COLORS.textSecondary }}>
              Recibirás un email de confirmación en breve.
            </p>

            <button
              onClick={() => router.push("/")}
              style={{
                width: "100%", padding: "11px", borderRadius: 8,
                background: COLORS.brand, border: "none",
                color: "#0d0f10", fontSize: 14, fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Volver al inicio
            </button>
          </>
        )}

        {/* ── Error ── */}
        {state === "error" && (
          <>
            <div className="text-center space-y-2">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto text-xl"
                style={{ background: COLORS.errorBg, color: COLORS.error }}
                aria-hidden="true"
              >
                ✕
              </div>
              <h1 className="text-xl font-bold" style={{ color: COLORS.textPrimary }}>
                No se pudo cancelar
              </h1>
              <p className="text-sm" style={{ color: COLORS.textSecondary }}>
                {errorMsg}
              </p>
            </div>

            <p className="text-sm text-center" style={{ color: COLORS.textSecondary }}>
              Si necesitas ayuda escribe a{" "}
              <a href="mailto:contacto@gustavoai.dev" style={{ color: COLORS.brand }}>
                contacto@gustavoai.dev
              </a>
            </p>

            <button
              onClick={() => router.push("/")}
              style={{
                width: "100%", padding: "11px", borderRadius: 8,
                background: "none", border: `1px solid ${COLORS.border}`,
                color: COLORS.textMuted, fontSize: 14,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Volver al inicio
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function CancelarPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: COLORS.background }}
        >
          <Spinner />
        </div>
      }
    >
      <CancelarContent />
    </Suspense>
  );
}
