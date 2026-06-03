"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { COLORS } from "@/constants";
import { camelCaseCode } from "@/constants/errors";
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
  const t       = useTranslations("pages.cancelar");
  const tErrors = useTranslations("errors");
  const token   = params.get("token");

  const [state,        setState]        = useState<PageState>(token ? "confirm" : "error");
  const [errorMsg,     setErrorMsg]     = useState(token ? "" : t("invalidLink"));
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
        setErrorMsg(
          data.error
            ? tErrors(`domain.${camelCaseCode(data.error)}`)
            : tErrors(`http.${res.status}`)
        );
        setState("error");
        return;
      }

      setSessionLabel(data.sessionLabel);
      setCreditsBack(data.creditsRestored);
      setState("success");
    } catch {
      setErrorMsg(tErrors("http.502"));
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
            <Eyebrow tone="warning">{t("confirmEyebrow")}</Eyebrow>
            <FbTitle>{t("confirmTitle")}</FbTitle>
            <FbBody>{t("confirmBody")}</FbBody>
          </HeaderBlock>

          <InfoBox>
            <InfoRow glyph="redeem">
              {t("packRefundNote")}
            </InfoRow>
            <InfoRow glyph="payments">
              {t("paidRefundNote")}
            </InfoRow>
          </InfoBox>

          <div style={{ display: "flex", gap: 10 }}>
            <FbButton variant="ghost" onClick={() => router.push("/")} style={{ flex: 1 }}>
              {t("keepBooking")}
            </FbButton>
            <FbButton variant="danger" onClick={handleConfirm} style={{ flex: 1 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
                delete_outline
              </span>
              {t("confirmCancel")}
            </FbButton>
          </div>

          <Helper>
            <MiniIcon glyph="lock" />
            {t("secureLink")}
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
          <FbBody>{t("processing")}</FbBody>
        </div>
      )}

      {/* ── Success ── */}
      {state === "success" && (
        <>
          <IconHalo tone="success" glyph="task_alt" />

          <HeaderBlock>
            <Eyebrow tone="success">{t("cancelledEyebrow")}</Eyebrow>
            <FbTitle>{t("cancelledTitle")}</FbTitle>
            <FbBody>
              {sessionLabel && t("sessionCancelled", { sessionLabel: sessionLabel.toLowerCase() })}
            </FbBody>
          </HeaderBlock>

          {creditsBack && (
            <InfoBox tone="success">
              <InfoRow glyph="redeem" tone="success">
                <div style={{ fontWeight: 600, color: COLORS.brand, marginBottom: 1 }}>
                  {t("creditReturnedTitle")}
                </div>
                <div style={{ fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                  {t("creditReturnedNote")}
                </div>
              </InfoRow>
            </InfoBox>
          )}

          <FbButton variant="primary" onClick={() => router.push("/")} style={{ width: "100%" }}>
            {t("backToHome")}
          </FbButton>

          <Helper>
            <MiniIcon glyph="mail" />
            {t("emailConfirmNote")}
          </Helper>
        </>
      )}

      {/* ── Error ── */}
      {state === "error" && (
        <>
          <IconHalo tone="error" glyph="error" />

          <HeaderBlock>
            <Eyebrow tone="error">{t("errorEyebrow")}</Eyebrow>
            <FbTitle>{t("errorTitle")}</FbTitle>
            <FbBody>{errorMsg}</FbBody>
          </HeaderBlock>

          <FbButton variant="ghost" onClick={() => router.push("/")} style={{ width: "100%" }}>
            {t("backToHome")}
          </FbButton>

          <Helper>
            <a href="mailto:contacto@gustavoai.dev" style={{ color: COLORS.brand, textDecoration: "none" }}>
              {t("errorHelp")}
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
