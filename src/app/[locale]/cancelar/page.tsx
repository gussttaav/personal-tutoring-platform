"use client";

import { useState, Suspense } from "react";
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
  Helper,
  MiniIcon,
} from "@/components/ui";

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
    <FeedbackMain>
      {/* ── Confirm ── */}
      {state === "confirm" && (
        <>
          <IconHalo tone="warning" glyph="event_busy" />

          <HeaderBlock>
            <Eyebrow tone="warning">Confirmación requerida</Eyebrow>
            <FbTitle>Cancelar reserva</FbTitle>
            <FbBody>
              ¿Confirmas que quieres cancelar esta sesión? Esta acción no se puede deshacer.
            </FbBody>
          </HeaderBlock>

          <InfoBox>
            <InfoRow glyph="redeem">
              Si tienes clases de <b style={{ color: COLORS.textPrimary, fontWeight: 600 }}>pack</b>,
              el crédito se devolverá automáticamente.
            </InfoRow>
            <InfoRow glyph="payments">
              Para sesiones individuales pagadas, Gustavo tramitará el{" "}
              <b style={{ color: COLORS.textPrimary, fontWeight: 600 }}>reembolso en 1–3 días</b> hábiles.
            </InfoRow>
          </InfoBox>

          <div style={{ display: "flex", gap: 10 }}>
            <FbButton variant="ghost" onClick={() => router.push("/")} style={{ flex: 1 }}>
              Mantener reserva
            </FbButton>
            <FbButton variant="danger" onClick={handleConfirm} style={{ flex: 1 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
                delete_outline
              </span>
              Sí, cancelar
            </FbButton>
          </div>

          <Helper>
            <MiniIcon glyph="lock" />
            Enlace seguro y de un solo uso
          </Helper>
        </>
      )}

      {/* ── Processing ── */}
      {state === "processing" && (
        <div
          className="text-center"
          style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", padding: "20px 0" }}
        >
          <Spinner />
          <FbBody>Procesando cancelación…</FbBody>
        </div>
      )}

      {/* ── Success ── */}
      {state === "success" && (
        <>
          <IconHalo tone="success" glyph="task_alt" />

          <HeaderBlock>
            <Eyebrow tone="success">Reserva cancelada</Eyebrow>
            <FbTitle>Reserva cancelada</FbTitle>
            <FbBody>
              {sessionLabel && `Tu ${sessionLabel.toLowerCase()} ha sido cancelada.`}
            </FbBody>
          </HeaderBlock>

          {creditsBack && (
            <InfoBox tone="success">
              <InfoRow glyph="redeem" tone="success">
                <div style={{ fontWeight: 600, color: COLORS.brand, marginBottom: 1 }}>
                  Tu crédito ha sido devuelto al pack
                </div>
                <div style={{ fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                  Puedes reservar otra clase cuando quieras.
                </div>
              </InfoRow>
            </InfoBox>
          )}

          <FbButton variant="primary" onClick={() => router.push("/")} style={{ width: "100%" }}>
            Volver al inicio
          </FbButton>

          <Helper>
            <MiniIcon glyph="mail" />
            Recibirás un email de confirmación en breve
          </Helper>
        </>
      )}

      {/* ── Error ── */}
      {state === "error" && (
        <>
          <IconHalo tone="error" glyph="error" />

          <HeaderBlock>
            <Eyebrow tone="error">No se pudo cancelar</Eyebrow>
            <FbTitle>No se pudo cancelar</FbTitle>
            <FbBody>{errorMsg}</FbBody>
          </HeaderBlock>

          <FbButton variant="ghost" onClick={() => router.push("/")} style={{ width: "100%" }}>
            Volver al inicio
          </FbButton>

          <Helper>
            Si necesitas ayuda escribe a{" "}
            <a href="mailto:contacto@gustavoai.dev" style={{ color: COLORS.brand, textDecoration: "none" }}>
              contacto@gustavoai.dev
            </a>
          </Helper>
        </>
      )}
    </FeedbackMain>
  );
}

export default function CancelarPage() {
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
      <CancelarContent />
    </Suspense>
  );
}
