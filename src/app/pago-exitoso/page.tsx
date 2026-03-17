"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button, Alert, Spinner } from "@/components/ui";
import { COLORS } from "@/constants";
import { useSSECredits } from "@/hooks/useSSECredits";

function SuccessContent() {
  const params = useSearchParams();
  const router = useRouter();

  const sessionId = params.get("session_id");

  // SSE connection — opens immediately if we have a session_id.
  // The server resolves the email/name/packSize from Stripe directly,
  // so we never need to call /api/stripe/session from the client.
  const { state, credits, name, packSize } = useSSECredits({ sessionId });

  const isConnecting = state === "connecting";
  const isConfirmed = state === "confirmed" && credits !== null;
  const isTimeout = state === "timeout";
  const isError = state === "error";

  if (!sessionId) {
    return (
      <PageShell>
        <Alert variant="error">Sesión de pago no encontrada.</Alert>
        <Button variant="secondary" fullWidth onClick={() => router.push("/")}>
          Volver al inicio
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Icon */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl font-bold"
        style={{ backgroundColor: COLORS.brandMuted, color: COLORS.brand }}
        aria-hidden="true"
      >
        ✓
      </div>

      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">¡Pago completado!</h1>
        {name && (
          <p className="mt-2 text-sm" style={{ color: COLORS.textSecondary }}>
            Gracias, <strong className="text-white">{name}</strong>.{" "}
            {packSize && `Tu Pack ${packSize} ha sido activado.`}
          </p>
        )}
      </div>

      {/* Credits status */}
      {isConnecting && (
        <div
          className="rounded-xl p-4 text-sm text-center"
          style={{ backgroundColor: "#0f1117", border: `1px solid ${COLORS.border}` }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full border border-t-transparent animate-spin"
              style={{ borderColor: COLORS.brand, borderTopColor: "transparent" }}
            />
            <p style={{ color: COLORS.textSecondary }}>Activando tus créditos…</p>
          </div>
          <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
            Esto puede tardar unos segundos.
          </p>
        </div>
      )}

      {isTimeout && (
        <Alert variant="warning">
          La activación está tardando más de lo esperado. Si no ves tus créditos en
          unos minutos, contacta con Gustavo.
        </Alert>
      )}

      {(isError) && (
        <Alert variant="error">
          Error al conectar con el servidor. Por favor recarga la página.
        </Alert>
      )}

      {isConfirmed && credits !== null && (
        <div
          className="rounded-xl p-4 text-center"
          style={{
            backgroundColor: COLORS.successBg,
            border: `1px solid ${COLORS.successBorder}`,
          }}
        >
          <p className="font-semibold text-lg" style={{ color: COLORS.brand }}>
            🎉 {credits} clase{credits !== 1 ? "s" : ""} disponible{credits !== 1 ? "s" : ""}
          </p>
          <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
            Válidas 6 meses · Reserva cuando quieras
          </p>
        </div>
      )}

      {/* CTA */}
      <Button
        variant="primary"
        fullWidth
        onClick={() => router.push("/")}
        disabled={!isConfirmed}
      >
        {isConfirmed ? "Reservar mis clases →" : "Esperando confirmación..."}
      </Button>

      <a href="/" className="block text-xs text-center" style={{ color: COLORS.textMuted }}>
        Volver al inicio
      </a>
    </PageShell>
  );
}

// ─── Layout shell ─────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: COLORS.background }}
    >
      <div
        className="rounded-2xl shadow-2xl p-8 sm:p-10 max-w-md w-full space-y-6"
        style={{
          backgroundColor: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        {children}
      </div>
    </main>
  );
}

export default function PagoExitosoPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: COLORS.background }}
        >
          <Spinner />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
