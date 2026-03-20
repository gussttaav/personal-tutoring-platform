"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";
import { COLORS } from "@/constants";

const REDIRECT_SECONDS = 5;

const DURATION_LABELS: Record<string, string> = {
  "1h": "1 hora",
  "2h": "2 horas",
};

function SesionConfirmadaContent() {
  const params    = useSearchParams();
  const router    = useRouter();
  const sessionId = params.get("session_id");

  type PageState = "loading" | "success" | "error";
  const [state,     setState]    = useState<PageState>("loading");
  const [duration,  setDuration] = useState<string>("");
  const [errorMsg,  setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);

  // Step 1 — verify the Stripe session server-side
  useEffect(() => {
    if (!sessionId) {
      setErrorMsg("Sesión de pago no encontrada.");
      setState("error");
      return;
    }

    fetch(`/api/stripe/session?session_id=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setErrorMsg(data.error);
          setState("error");
        } else {
          // session_duration is stored in Stripe metadata
          setDuration(data.sessionDuration ?? "");
          setState("success");
        }
      })
      .catch(() => {
        setErrorMsg("Error al verificar el pago.");
        setState("error");
      });
  }, [sessionId]);

  // Step 2 — tick the countdown
  useEffect(() => {
    if (state !== "success") return;

    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [state]);

  // Step 3 — redirect when countdown reaches 0 (separate effect, never called during render)
  useEffect(() => {
    if (state === "success" && countdown === 0) {
      router.push("/");
    }
  }, [state, countdown, router]);

  if (state === "loading") {
    return (
      <PageShell>
        <Spinner />
        <p className="text-sm mt-3" style={{ color: COLORS.textSecondary }}>
          Verificando pago...
        </p>
      </PageShell>
    );
  }

  if (state === "error") {
    return (
      <PageShell>
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto text-xl"
          style={{ background: COLORS.errorBg, color: COLORS.error }}
          aria-hidden="true"
        >
          ✕
        </div>
        <h1
          className="text-xl font-bold text-center"
          style={{ color: COLORS.textPrimary }}
        >
          Algo salió mal
        </h1>
        <p
          className="text-sm text-center"
          style={{ color: COLORS.textSecondary }}
        >
          {errorMsg}
        </p>
        <button
          onClick={() => router.push("/")}
          className="w-full py-2.5 rounded-xl text-sm font-medium"
          style={{
            background: COLORS.surface,
            color: COLORS.textSecondary,
            border: `1px solid ${COLORS.border}`,
            cursor: "pointer",
          }}
        >
          Volver al inicio
        </button>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Icon */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl"
        style={{ background: COLORS.brandMuted, color: COLORS.brand }}
        aria-hidden="true"
      >
        ✓
      </div>

      {/* Title */}
      <div className="text-center">
        <h1
          className="text-2xl font-bold"
          style={{ color: COLORS.textPrimary }}
        >
          ¡Pago confirmado!
        </h1>
        <p className="mt-2 text-sm" style={{ color: COLORS.textSecondary }}>
          Tu sesión de{" "}
          <strong style={{ color: COLORS.textPrimary }}>
            {DURATION_LABELS[duration] ?? duration}
          </strong>{" "}
          ha sido reservada y pagada.
        </p>
      </div>

      {/* Info */}
      <div
        className="rounded-xl p-4 text-sm space-y-1"
        style={{
          background: COLORS.background,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <p style={{ color: COLORS.textSecondary }}>
          📅 Revisa tu email para los detalles de la cita
        </p>
        <p style={{ color: COLORS.textSecondary }}>
          🔗 El enlace de Google Meet llegará en la confirmación
        </p>
        <p style={{ color: COLORS.textSecondary }}>
          ↩️ Puedes cancelar hasta 2 horas antes
        </p>
      </div>

      {/* Countdown */}
      <p className="text-sm text-center" style={{ color: COLORS.textMuted }}>
        Volviendo al inicio en{" "}
        <span style={{ color: COLORS.brand, fontWeight: 500 }}>
          {countdown}s
        </span>
        …
      </p>

      <button
        onClick={() => router.push("/")}
        className="w-full py-2.5 rounded-xl text-sm font-medium"
        style={{
          background: COLORS.brand,
          color: "#0d0f10",
          border: "none",
          cursor: "pointer",
        }}
      >
        Volver al inicio ahora
      </button>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: COLORS.background, position: "relative", zIndex: 1 }}
    >
      <div
        className="rounded-2xl shadow-2xl p-8 sm:p-10 max-w-md w-full space-y-6"
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        {children}
      </div>
    </main>
  );
}

export default function SesionConfirmadaPage() {
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
      <SesionConfirmadaContent />
    </Suspense>
  );
}
