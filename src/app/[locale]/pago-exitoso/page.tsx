"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { COLORS } from "@/constants";
import {
  Spinner,
  ATMOSPHERE_BG,
  FeedbackMain,
  IconHalo,
  Eyebrow,
  FbTitle,
  FbBody,
  HeaderBlock,
  InfoBox,
  InfoRow,
  FbButton,
  LoadingDots,
  Steps,
  Helper,
  MiniIcon,
} from "@/components/ui";
import { useSSECredits } from "@/hooks/useSSECredits";

function SuccessContent() {
  const params = useSearchParams();
  const router = useRouter();

  const paymentIntentId = params.get("payment_intent_id");

  // SSE connection — opens immediately if we have a payment_intent_id.
  // The server resolves the email/name/packSize from Stripe directly,
  // so we never need to call /api/stripe/session from the client.
  const { state, credits, name, packSize } = useSSECredits({ paymentIntentId });

  const isConnecting = state === "connecting";
  const isConfirmed  = state === "confirmed" && credits !== null;
  const isTimeout    = state === "timeout";
  const isError      = state === "error";

  // ── No payment intent — invalid / expired URL ──
  if (!paymentIntentId) {
    return (
      <FeedbackMain>
        <IconHalo tone="error" glyph="link_off" />
        <HeaderBlock>
          <Eyebrow tone="error">Sesión no encontrada</Eyebrow>
          <FbTitle>No encontramos tu pago</FbTitle>
          <FbBody>
            Has llegado a esta página sin un identificador de pago válido.
            Probablemente la URL está incompleta o ha expirado.
          </FbBody>
        </HeaderBlock>

        <InfoBox>
          <InfoRow glyph="history">
            Si acabas de pagar, comprueba tu email — incluimos siempre un enlace
            fresco al recibo.
          </InfoRow>
          <InfoRow glyph="payments">
            <b style={{ color: COLORS.textPrimary, fontWeight: 600 }}>No se ha cobrado nada</b>{" "}
            simplemente por visitar esta página.
          </InfoRow>
        </InfoBox>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FbButton variant="primary" onClick={() => router.push("/")} style={{ width: "100%" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
              home
            </span>
            Volver al inicio
          </FbButton>
          <FbButton variant="ghost" onClick={() => router.push("/area-personal")} style={{ width: "100%" }}>
            Ir a mi área personal
          </FbButton>
        </div>

        <Helper>
          ¿Crees que es un error? ·{" "}
          <a href="mailto:contacto@gustavoai.dev" style={{ color: COLORS.brand, textDecoration: "none" }}>
            contacto@gustavoai.dev
          </a>
        </Helper>
      </FeedbackMain>
    );
  }

  /**
   * After a successful pack purchase the user wants to book their first class
   * immediately. We redirect to /?action=schedule-pack so InteractiveShell
   * can read that param on mount and open the pack booking view automatically,
   * without the user having to find and click "Reservar mis clases" manually.
   */
  function handleScheduleClasses() {
    router.push("/?action=schedule-pack");
  }

  // ── Connecting — activating credits ──
  if (isConnecting) {
    return (
      <FeedbackMain>
        <IconHalo tone="neutral" spinner />
        <HeaderBlock>
          <Eyebrow tone="neutral">Pago recibido</Eyebrow>
          <FbTitle>Activando tus créditos</FbTitle>
          <FbBody>
            {name ? (
              <>
                Gracias, <strong style={{ color: COLORS.textPrimary, fontWeight: 600 }}>{name}</strong>.{" "}
                Estamos sincronizando tus créditos con la plataforma.
              </>
            ) : (
              "Estamos sincronizando tus créditos con la plataforma."
            )}
          </FbBody>
        </HeaderBlock>

        <Steps
          items={[
            { glyph: "check", label: "Pago verificado por Stripe", state: "done" },
            { glyph: "sync", label: "Activando créditos en tu cuenta", state: "load" },
            { glyph: "mail", label: "Enviar recibo por email", state: "wait" },
          ]}
        />

        <FbButton variant="disabled">
          Esperando confirmación
          <LoadingDots />
        </FbButton>

        <Helper>Esto puede tardar unos segundos · no cierres la página</Helper>
      </FeedbackMain>
    );
  }

  // ── Confirmed — pack active ──
  if (isConfirmed && credits !== null) {
    return (
      <FeedbackMain>
        <IconHalo tone="success" glyph="check" />
        <HeaderBlock>
          <Eyebrow tone="success">Pago completado</Eyebrow>
          <FbTitle>{packSize ? `¡Tu Pack ${packSize} está activo!` : "¡Pago completado!"}</FbTitle>
          <FbBody>
            {name ? (
              <>
                Gracias, <strong style={{ color: COLORS.textPrimary, fontWeight: 600 }}>{name}</strong>.{" "}
                Hemos sincronizado tus créditos.
              </>
            ) : (
              "Hemos sincronizado tus créditos."
            )}
          </FbBody>
        </HeaderBlock>

        <InfoBox tone="success">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
            <div
              style={{
                fontFamily: "var(--font-headline)", fontSize: 32, fontWeight: 800,
                letterSpacing: "-0.02em", lineHeight: 1, color: COLORS.brand,
              }}
            >
              {credits} clase{credits !== 1 ? "s" : ""}
              <small
                style={{
                  display: "block", marginTop: 6, fontSize: 12, fontWeight: 500,
                  color: COLORS.textSecondary, letterSpacing: 0,
                }}
              >
                disponible{credits !== 1 ? "s" : ""} para reservar
              </small>
            </div>
            <div
              style={{
                fontSize: 11, color: COLORS.textSecondary, padding: "5px 10px",
                borderRadius: 999, background: "rgba(0,0,0,0.25)",
                border: `1px solid ${COLORS.border}`, whiteSpace: "nowrap",
              }}
            >
              Válidas 6 meses
            </div>
          </div>
        </InfoBox>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FbButton variant="primary" onClick={handleScheduleClasses} style={{ width: "100%" }}>
            Reservar mis clases
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
              arrow_forward
            </span>
          </FbButton>
          <FbButton variant="ghost" onClick={() => router.push("/")} style={{ width: "100%" }}>
            Volver al inicio
          </FbButton>
        </div>

        <Helper>
          <MiniIcon glyph="mail" />
          Te hemos enviado el recibo por email
        </Helper>
      </FeedbackMain>
    );
  }

  // ── Timeout — taking longer than usual ──
  if (isTimeout) {
    return (
      <FeedbackMain>
        <IconHalo tone="warning" glyph="hourglass_top" />
        <HeaderBlock>
          <Eyebrow tone="warning">Tardando un poco más</Eyebrow>
          <FbTitle>Esto está tardando más de lo normal</FbTitle>
          <FbBody>
            Tu pago se completó correctamente. La activación de créditos suele ser
            inmediata, pero ocasionalmente puede tomar unos minutos.
          </FbBody>
        </HeaderBlock>

        <InfoBox tone="warning">
          <InfoRow glyph="verified_user" tone="warning">
            <b style={{ color: COLORS.textPrimary, fontWeight: 600 }}>Tu pago está seguro.</b>{" "}
            Lo procesó Stripe sin errores.
          </InfoRow>
          <InfoRow glyph="forum" tone="warning">
            Si no ves tus créditos en unos minutos, te contactaremos automáticamente.
          </InfoRow>
        </InfoBox>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FbButton variant="primary" onClick={() => window.location.reload()} style={{ width: "100%" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
              refresh
            </span>
            Comprobar de nuevo
          </FbButton>
          <FbButton
            variant="ghost"
            onClick={() => { window.location.href = "mailto:contacto@gustavoai.dev"; }}
            style={{ width: "100%" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
              mail
            </span>
            Contactar con Gustavo
          </FbButton>
        </div>

        <Helper>
          Referencia ·{" "}
          <span style={{ fontFamily: "var(--font-mono, monospace)", color: COLORS.textSecondary }}>
            {paymentIntentId}
          </span>
        </Helper>
      </FeedbackMain>
    );
  }

  // ── Error — lost SSE connection ──
  if (isError) {
    return (
      <FeedbackMain>
        <IconHalo tone="error" glyph="cloud_off" />
        <HeaderBlock>
          <Eyebrow tone="error">Sin conexión</Eyebrow>
          <FbTitle>No podemos confirmarlo ahora</FbTitle>
          <FbBody>
            Perdimos la conexión con el servidor mientras activábamos tus créditos.{" "}
            <strong style={{ color: COLORS.textPrimary, fontWeight: 600 }}>
              Tu pago se realizó correctamente.
            </strong>
          </FbBody>
        </HeaderBlock>

        <InfoBox tone="error">
          <InfoRow glyph="verified_user" tone="error">
            El cobro de Stripe está confirmado y no se duplicará.
          </InfoRow>
          <InfoRow glyph="refresh" tone="error">
            Recarga la página o vuelve en unos minutos para ver tus créditos.
          </InfoRow>
        </InfoBox>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FbButton variant="primary" onClick={() => window.location.reload()} style={{ width: "100%" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
              refresh
            </span>
            Recargar la página
          </FbButton>
          <FbButton variant="ghost" onClick={() => router.push("/area-personal")} style={{ width: "100%" }}>
            Ir a mi área personal
          </FbButton>
        </div>

        <Helper>
          Si el problema persiste ·{" "}
          <a href="mailto:contacto@gustavoai.dev" style={{ color: COLORS.brand, textDecoration: "none" }}>
            contacto@gustavoai.dev
          </a>
        </Helper>
      </FeedbackMain>
    );
  }

  // Fallback (idle / transient) — keep the connecting shell.
  return (
    <FeedbackMain>
      <IconHalo tone="neutral" spinner />
      <HeaderBlock>
        <Eyebrow tone="neutral">Pago recibido</Eyebrow>
        <FbTitle>Activando tus créditos</FbTitle>
        <FbBody>Estamos sincronizando tus créditos con la plataforma.</FbBody>
      </HeaderBlock>
      <Helper>Esto puede tardar unos segundos · no cierres la página</Helper>
    </FeedbackMain>
  );
}

export default function PagoExitosoPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: ATMOSPHERE_BG }}
        >
          <Spinner />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
