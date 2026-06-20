"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { COLORS } from "@/constants";
import { camelCaseCode } from "@/constants/errors";
import { useSessionPriceLabel } from "@/components/pricing/PricesProvider";
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

// ─── Payment-only blocks ────────────────────────────────────────────────────

function ReceiptBlock({ duration }: { duration: string }) {
  const t = useTranslations("pages.sesionConfirmada");
  const durationLabel = duration === "1h" ? t("duration1h") : t("duration2h");
  const name  = t("sessionIndividual", { duration: durationLabel });
  // Live price from the pricing table, so the receipt matches the charged amount.
  const sessionPrice = useSessionPriceLabel(duration === "1h" ? "session1h" : "session2h");
  const price = duration === "1h" || duration === "2h" ? sessionPrice ?? undefined : undefined;
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
          {t("paidBadge")}
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
            {t("vatIncluded")}
          </small>
        </div>
      )}
    </div>
  );
}

function SesionConfirmadaContent() {
  const params          = useSearchParams();
  const router          = useRouter();
  const t               = useTranslations("pages.sesionConfirmada");
  const tErrors         = useTranslations("errors");
  const paymentIntentId = params.get("payment_intent_id");

  type S = "loading" | "success" | "error";
  // Lazy init: if there's no payment intent there's nothing to verify — start in
  // the error state instead of correcting it synchronously inside the effect.
  const [state,    setState]    = useState<S>(() => (paymentIntentId ? "loading" : "error"));
  const [duration, setDuration] = useState("");
  const [errorMsg, setErrorMsg] = useState(() => (paymentIntentId ? "" : t("errorPaymentNotFound")));

  useEffect(() => {
    if (!paymentIntentId) return;
    fetch(`/api/stripe/session?payment_intent_id=${encodeURIComponent(paymentIntentId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setErrorMsg(tErrors(`domain.${camelCaseCode(d.error)}`));
          setState("error");
        } else {
          setDuration(d.sessionDuration ?? "");
          setState("success");
        }
      })
      .catch(() => {
        setErrorMsg(tErrors("http.500"));
        setState("error");
      });
  }, [paymentIntentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading — verifying payment ──
  if (state === "loading") {
    return (
      <FeedbackMain>
        <IconHalo tone="neutral" spinner />
        <HeaderBlock>
          <Eyebrow tone="neutral">{t("verifyingEyebrow")}</Eyebrow>
          <FbTitle>{t("verifyingTitle")}</FbTitle>
          <FbBody>{t("verifyingBody")}</FbBody>
        </HeaderBlock>

        <Steps
          items={[
            { glyph: "check", label: t("steps.stripe"),    state: "done" },
            { glyph: "sync",  label: t("steps.verifying"), state: "load" },
            { glyph: "mail",  label: t("steps.email"),     state: "wait" },
          ]}
        />

        <FbButton variant="disabled">
          {t("verifyingStatus")}
          <LoadingDots />
        </FbButton>

        <Helper>
          <MiniIcon glyph="lock" />
          {t("paymentSafe")}
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
          <Eyebrow tone="error">{t("errorEyebrow")}</Eyebrow>
          <FbTitle>{t("errorTitle")}</FbTitle>
          <FbBody>{t("errorBody")}</FbBody>
        </HeaderBlock>

        <InfoBox tone="error">
          <InfoRow glyph="info" tone="error">
            {errorMsg}
          </InfoRow>
          <InfoRow glyph="mail" tone="error">
            {t("autoEmailNote")}
          </InfoRow>
          {paymentIntentId && (
            <InfoRow glyph="tag" tone="error">
              {t("referenceLabel")}{" "}
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
            {t("contactGustavo")}
          </FbButton>
          <FbButton variant="ghost" onClick={() => router.push("/")} style={{ width: "100%" }}>
            {t("backToHome")}
          </FbButton>
        </div>

        <Helper>
          <a href="mailto:contacto@gustavoai.dev" style={{ color: COLORS.brand, textDecoration: "none" }}>
            {t("contactHelp")}
          </a>
        </Helper>
      </FeedbackMain>
    );
  }

  // ── Success — payment confirmed ──
  return (
    <FeedbackMain>
      <IconHalo tone="success" glyph="check" />
      <HeaderBlock>
        <Eyebrow tone="success">{t("successEyebrow")}</Eyebrow>
        <FbTitle>{t("successTitle")}</FbTitle>
        <FbBody>{t("successBody")}</FbBody>
      </HeaderBlock>

      <ReceiptBlock duration={duration} />

      <ConfirmationChecklist />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <FbButton variant="primary" onClick={() => router.push("/area-personal")} style={{ width: "100%" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">login</span>
          {t("goToPersonalArea")}
        </FbButton>
        <FbButton variant="ghost" onClick={() => router.push("/")} style={{ width: "100%" }}>
          {t("backToHome")}
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
