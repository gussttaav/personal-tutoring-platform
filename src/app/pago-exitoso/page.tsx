"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button, Alert, Spinner } from "@/components/ui";
import { COLORS } from "@/constants";
import { useCreditsPoller } from "@/hooks/useCreditsPoller";

interface SessionData {
  email: string;
  name: string;
  packSize: number;
}

function SuccessContent() {
  const params = useSearchParams();
  const router = useRouter();

  const sessionId = params.get("session_id");

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);

  // Step 1: fetch session metadata from server (email/name never in URL)
  useEffect(() => {
    if (!sessionId) {
      setSessionError("Sesión de pago no encontrada.");
      setSessionLoading(false);
      return;
    }

    fetch(`/api/stripe/session?session_id=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setSessionError(data.error);
        } else {
          setSessionData(data);
        }
      })
      .catch(() => setSessionError("Error al verificar el pago."))
      .finally(() => setSessionLoading(false));
  }, [sessionId]);

  // Step 2: poll for credits once we have the email
  const { state: pollState, credits } = useCreditsPoller({
    enabled: !!sessionData,
  });

  function goToBooking() {
    if (!sessionData || !credits) return;
    router.push(
      `/?booking=1&email=${encodeURIComponent(sessionData.email)}&name=${encodeURIComponent(sessionData.name)}&credits=${credits}`
    );
  }

  // ── Loading session ──
  if (sessionLoading) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-sm" style={{ color: COLORS.textSecondary }}>
            Verificando pago...
          </p>
        </div>
      </PageShell>
    );
  }

  // ── Session error ──
  if (sessionError || !sessionData) {
    return (
      <PageShell>
        <Alert variant="error">{sessionError || "Error al verificar el pago."}</Alert>
        <Button variant="secondary" fullWidth onClick={() => router.push("/")}>
          Volver al inicio
        </Button>
      </PageShell>
    );
  }

  const isCreditsReady = pollState === "confirmed" && credits !== null;
  const isTimeout = pollState === "timeout";

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
        <p className="mt-2 text-sm" style={{ color: COLORS.textSecondary }}>
          Gracias, <strong className="text-white">{sessionData.name}</strong>.{" "}
          Tu Pack {sessionData.packSize} ha sido activado.
        </p>
      </div>

      {/* Credits status */}
      {!isCreditsReady && !isTimeout && (
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

      {isCreditsReady && credits !== null && (
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
        onClick={goToBooking}
        disabled={!isCreditsReady}
      >
        {isCreditsReady ? "Reservar mis clases →" : "Esperando confirmación..."}
      </Button>

      <a
        href="/"
        className="block text-xs text-center"
        style={{ color: COLORS.textMuted }}
      >
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
