"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t      = useTranslations("pages.pagoExitoso");

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
          <Eyebrow tone="error">{t("noPaymentEyebrow")}</Eyebrow>
          <FbTitle>{t("noPaymentTitle")}</FbTitle>
          <FbBody>{t("noPaymentBody")}</FbBody>
        </HeaderBlock>

        <InfoBox>
          <InfoRow glyph="history">
            {t("receiptEmailHint")}
          </InfoRow>
          <InfoRow glyph="payments">
            <b style={{ color: COLORS.textPrimary, fontWeight: 600 }}>{t("noCharge")}</b>
          </InfoRow>
        </InfoBox>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FbButton variant="primary" onClick={() => router.push("/")} style={{ width: "100%" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
              home
            </span>
            {t("backToHome")}
          </FbButton>
          <FbButton variant="ghost" onClick={() => router.push("/area-personal")} style={{ width: "100%" }}>
            {t("goToPersonalArea")}
          </FbButton>
        </div>

        <Helper>
          <a href="mailto:contacto@gustavoai.dev" style={{ color: COLORS.brand, textDecoration: "none" }}>
            {t("thinkItsError")}
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
          <Eyebrow tone="neutral">{t("connectingEyebrow")}</Eyebrow>
          <FbTitle>{t("connectingTitle")}</FbTitle>
          <FbBody>
            {name ? t("syncingCredits", { name }) : t("syncingCreditsAnon")}
          </FbBody>
        </HeaderBlock>

        <Steps
          items={[
            { glyph: "check", label: t("steps.verified"), state: "done" },
            { glyph: "sync",  label: t("steps.activating"), state: "load" },
            { glyph: "mail",  label: t("steps.receipt"), state: "wait" },
          ]}
        />

        <FbButton variant="disabled">
          {t("waitingConfirmation")}
          <LoadingDots />
        </FbButton>

        <Helper>{t("waitingHint")}</Helper>
      </FeedbackMain>
    );
  }

  // ── Confirmed — pack active ──
  if (isConfirmed && credits !== null) {
    return (
      <FeedbackMain>
        <IconHalo tone="success" glyph="check" />
        <HeaderBlock>
          <Eyebrow tone="success">{t("confirmedEyebrow")}</Eyebrow>
          <FbTitle>{packSize ? t("packActive", { packSize }) : t("paymentCompleted")}</FbTitle>
          <FbBody>
            {name ? t("creditsSynced", { name }) : t("creditsSyncedAnon")}
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
              {t("creditsLabel", { credits })}
              <small
                style={{
                  display: "block", marginTop: 6, fontSize: 12, fontWeight: 500,
                  color: COLORS.textSecondary, letterSpacing: 0,
                }}
              >
                {t("creditsAvailableNote", { credits })}
              </small>
            </div>
            <div
              style={{
                fontSize: 11, color: COLORS.textSecondary, padding: "5px 10px",
                borderRadius: 999, background: "rgba(0,0,0,0.25)",
                border: `1px solid ${COLORS.border}`, whiteSpace: "nowrap",
              }}
            >
              {t("validityNote")}
            </div>
          </div>
        </InfoBox>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FbButton variant="primary" onClick={handleScheduleClasses} style={{ width: "100%" }}>
            {t("bookMyClasses")}
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
              arrow_forward
            </span>
          </FbButton>
          <FbButton variant="ghost" onClick={() => router.push("/")} style={{ width: "100%" }}>
            {t("backToHome")}
          </FbButton>
        </div>

        <Helper>
          <MiniIcon glyph="mail" />
          {t("receiptSent")}
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
          <Eyebrow tone="warning">{t("timeoutEyebrow")}</Eyebrow>
          <FbTitle>{t("timeoutTitle")}</FbTitle>
          <FbBody>{t("timeoutBody")}</FbBody>
        </HeaderBlock>

        <InfoBox tone="warning">
          <InfoRow glyph="verified_user" tone="warning">
            {t("paymentSafe")}
          </InfoRow>
          <InfoRow glyph="forum" tone="warning">
            {t("autoContact")}
          </InfoRow>
        </InfoBox>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FbButton variant="primary" onClick={() => window.location.reload()} style={{ width: "100%" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
              refresh
            </span>
            {t("checkAgain")}
          </FbButton>
          <FbButton
            variant="ghost"
            onClick={() => { window.location.href = "mailto:contacto@gustavoai.dev"; }}
            style={{ width: "100%" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
              mail
            </span>
            {t("contactGustavo")}
          </FbButton>
        </div>

        <Helper>
          {t("reference")}{" "}
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
          <Eyebrow tone="error">{t("errorEyebrow")}</Eyebrow>
          <FbTitle>{t("errorTitle")}</FbTitle>
          <FbBody>{t("errorBody")}</FbBody>
        </HeaderBlock>

        <InfoBox tone="error">
          <InfoRow glyph="verified_user" tone="error">
            {t("stripeConfirmed")}
          </InfoRow>
          <InfoRow glyph="refresh" tone="error">
            {t("reloadHint")}
          </InfoRow>
        </InfoBox>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FbButton variant="primary" onClick={() => window.location.reload()} style={{ width: "100%" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
              refresh
            </span>
            {t("reloadPage")}
          </FbButton>
          <FbButton variant="ghost" onClick={() => router.push("/area-personal")} style={{ width: "100%" }}>
            {t("goToPersonalArea")}
          </FbButton>
        </div>

        <Helper>
          <a href="mailto:contacto@gustavoai.dev" style={{ color: COLORS.brand, textDecoration: "none" }}>
            {t("errorHelp")}
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
        <Eyebrow tone="neutral">{t("connectingEyebrow")}</Eyebrow>
        <FbTitle>{t("connectingTitle")}</FbTitle>
        <FbBody>{t("syncingCreditsAnon")}</FbBody>
      </HeaderBlock>
      <Helper>{t("waitingHint")}</Helper>
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
