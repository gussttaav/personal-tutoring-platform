"use client";

import { useEffect, useState, Suspense } from "react";
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
  ConfirmationChecklist,
  Helper,
  MiniIcon,
} from "@/components/ui";
const DURATION_LABELS: Record<string, string> = { "1h": "1 hora", "2h": "2 horas" };

// Static single-session prices (mirror SESSION_CONFIGS in BookingModeView).
// Inlined deliberately: importing the BookingModeView component into this
// route just for two constants drags its whole interactive graph
// (WeeklyCalendar, BookingLayout, …) into the bundle.
const PRICE_BY_DURATION: Record<string, string> = { "1h": "€16", "2h": "€30" };

/** Single-session price for a Stripe `session_duration`. */
function priceForDuration(d: string): string | undefined {
  return PRICE_BY_DURATION[d];
}

// ─── Payment-only blocks ────────────────────────────────────────────────────

function ReceiptBlock({ duration }: { duration: string }) {
  const name  = `${DURATION_LABELS[duration] ?? duration} · individual`;
  const price = priceForDuration(duration);
  return (
    <div
      style={{
        background: "rgba(78,222,163,0.07)", border: `1px solid ${COLORS.successBorder}`,
        borderRadius: 11, padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 14,
      }}
    >
      <div
        style={{
          flexShrink: 0, width: 38, height: 38, borderRadius: 9,
          background: "rgba(78,222,163,0.12)", border: `1px solid ${COLORS.brandBorder}`,
          display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.brand,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">
          school
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 10, fontWeight: 700, color: COLORS.brand,
            letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px",
          }}
        >
          Sesión pagada
        </p>
        <p
          style={{
            fontFamily: "var(--font-headline)", fontSize: 14, fontWeight: 700,
            color: COLORS.textPrimary, margin: 0,
          }}
        >
          {name}
        </p>
      </div>
      {price && (
        <div
          style={{
            fontFamily: "var(--font-headline)", fontSize: 18, fontWeight: 800,
            color: COLORS.brand, letterSpacing: "-0.01em", lineHeight: 1, textAlign: "right",
          }}
        >
          {price}
          <small
            style={{
              display: "block", fontFamily: "inherit", fontSize: 10,
              color: COLORS.textMuted, fontWeight: 500, marginTop: 4,
            }}
          >
            IVA incluido
          </small>
        </div>
      )}
    </div>
  );
}

function SesionConfirmadaContent() {
  const params          = useSearchParams();
  const router          = useRouter();
  const paymentIntentId = params.get("payment_intent_id");

  type S = "loading" | "success" | "error";
  // Lazy init: if there's no payment intent there's nothing to verify — start in
  // the error state instead of correcting it synchronously inside the effect.
  const [state,    setState]    = useState<S>(() => (paymentIntentId ? "loading" : "error"));
  const [duration, setDuration] = useState("");
  const [errorMsg, setErrorMsg] = useState(() => (paymentIntentId ? "" : "Sesión de pago no encontrada."));

  useEffect(() => {
    if (!paymentIntentId) return;
    fetch(`/api/stripe/session?payment_intent_id=${encodeURIComponent(paymentIntentId)}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setErrorMsg(d.error); setState("error"); } else { setDuration(d.sessionDuration ?? ""); setState("success"); } })
      .catch(() => { setErrorMsg("Error al verificar el pago."); setState("error"); });
  }, [paymentIntentId]);

  // ── Loading — verifying payment ──
  if (state === "loading") {
    return (
      <FeedbackMain>
        <IconHalo tone="neutral" spinner />
        <HeaderBlock>
          <Eyebrow tone="neutral">Pago recibido</Eyebrow>
          <FbTitle>Verificando tu pago</FbTitle>
          <FbBody>
            Estamos confirmando con Stripe que el cobro se procesó correctamente y
            registrando tu sesión.
          </FbBody>
        </HeaderBlock>

        <Steps
          items={[
            { glyph: "check", label: "Pago procesado por Stripe", state: "done" },
            { glyph: "sync", label: "Verificando los detalles", state: "load" },
            { glyph: "mail", label: "Enviar email de confirmación", state: "wait" },
          ]}
        />

        <FbButton variant="disabled">
          Verificando
          <LoadingDots />
        </FbButton>

        <Helper>
          <MiniIcon glyph="lock" />
          Tu pago está seguro · no cierres la página
        </Helper>
      </FeedbackMain>
    );
  }

  // ── Error — verification failed (payment still safe) ──
  if (state === "error") {
    return (
      <FeedbackMain>
        <IconHalo tone="error" glyph="error" />
        <HeaderBlock>
          <Eyebrow tone="error">No se pudo verificar</Eyebrow>
          <FbTitle>Algo salió mal</FbTitle>
          <FbBody>
            No pudimos confirmar los detalles de tu sesión, pero{" "}
            <strong style={{ color: COLORS.textPrimary, fontWeight: 600 }}>
              tu pago está seguro
            </strong>
            .
          </FbBody>
        </HeaderBlock>

        <InfoBox tone="error">
          <InfoRow glyph="info" tone="error">
            {errorMsg}
          </InfoRow>
          <InfoRow glyph="mail" tone="error">
            Si el cobro fue correcto, llegará un{" "}
            <b style={{ color: COLORS.textPrimary, fontWeight: 600 }}>email de confirmación</b>{" "}
            automático en los próximos minutos.
          </InfoRow>
          {paymentIntentId && (
            <InfoRow glyph="tag" tone="error">
              Referencia ·{" "}
              <b style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12, color: COLORS.textPrimary }}>
                {paymentIntentId}
              </b>
            </InfoRow>
          )}
        </InfoBox>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FbButton
            variant="primary"
            onClick={() => { window.location.href = "mailto:contacto@gustavoai.dev"; }}
            style={{ width: "100%" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">forum</span>
            Contactar con Gustavo
          </FbButton>
          <FbButton variant="ghost" onClick={() => router.push("/")} style={{ width: "100%" }}>
            Volver al inicio
          </FbButton>
        </div>

        <Helper>
          Escribe a{" "}
          <a href="mailto:contacto@gustavoai.dev" style={{ color: COLORS.brand, textDecoration: "none" }}>
            contacto@gustavoai.dev
          </a>{" "}
          con la referencia
        </Helper>
      </FeedbackMain>
    );
  }

  // ── Success — payment confirmed ──
  return (
    <FeedbackMain>
      <IconHalo tone="success" glyph="check" />
      <HeaderBlock>
        <Eyebrow tone="success">Pago confirmado</Eyebrow>
        <FbTitle>¡Tu sesión está reservada!</FbTitle>
        <FbBody>¡Todo listo! Revisa tu correo para ver los detalles.</FbBody>
      </HeaderBlock>

      <ReceiptBlock duration={duration} />

      <ConfirmationChecklist />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <FbButton variant="primary" onClick={() => router.push("/area-personal")} style={{ width: "100%" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">login</span>
          Ir a mi área personal
        </FbButton>
        <FbButton variant="ghost" onClick={() => router.push("/")} style={{ width: "100%" }}>
          Volver al inicio
        </FbButton>
      </div>
    </FeedbackMain>
  );
}

export default function SesionConfirmadaPage() {
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
      <SesionConfirmadaContent />
    </Suspense>
  );
}
