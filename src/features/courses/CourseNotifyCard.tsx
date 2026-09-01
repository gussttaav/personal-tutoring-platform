"use client";

/*
 * COURSE-P6-02 / landing-refinements — "notify me about new courses".
 *
 * Replaces what the ComingSoonModal used to be for courses. The modal was a dead end that
 * happened to collect an email; this is an opt-in sitting under real content, which is the
 * only context in which asking is reasonable.
 *
 * ONE subscription (`type: "courses"`) means "new courses and updates to a course you've started".
 * There is no separate "tell me when English lands" flag on purpose: sends resolve language from
 * `users.locale`, so an English subscriber IS the audience for that announcement already.
 *
 * It is a toggle, not a one-way button, and that is the unsubscribe path the announce email links
 * to — no token infrastructure needed, because subscribing requires a signed-in account.
 *
 * Visual: the two invitation states (signed-out, and signed-in-not-subscribed) wear the landing
 * closing-CTA's card — a green-bordered gradient with a soft bloom (see CourseCta) — with the
 * primary gradient button. Once subscribed the card goes quiet: a plain surface + a secondary
 * outline button for the low-key opt-out. The `compact` variant (embedded in ContentLanguageNotice)
 * drops the card chrome entirely — it lives inside another box — and is just a divider + a row.
 */

import { useTranslations } from "next-intl";
import { useSubscription } from "@/hooks/useSubscription";

const primaryButtonStyle: React.CSSProperties = {
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "12px 24px",
  background: "linear-gradient(135deg, #4edea3, #10b981)",
  color: "var(--green-on)",
  border: "none",
  borderRadius: "11px",
  fontFamily: "var(--font-headline, Manrope), sans-serif",
  fontWeight: 700,
  fontSize: "0.875rem",
  cursor: "pointer",
  boxShadow: "0 10px 30px rgba(78,222,163,0.24)",
};

const secondaryButtonStyle: React.CSSProperties = {
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 22px",
  background: "transparent",
  color: "var(--text-muted)",
  border: "1px solid var(--border-variant)",
  borderRadius: "11px",
  fontFamily: "var(--font-headline, Manrope), sans-serif",
  fontWeight: 600,
  fontSize: "0.875rem",
  cursor: "pointer",
};

export default function CourseNotifyCard({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("courses.notify");
  const { state, busy, isSignedIn, toggle, reset } = useSubscription("courses");

  const isSubscribed = state === "subscribed";
  const isError      = state === "error";
  // The invitation states wear the CTA card + primary button; subscribed goes quiet.
  const promotional  = !isSubscribed;

  const message = isError
    ? t("error")
    : !isSignedIn
      ? t("signInHint")
      : isSubscribed
        ? t("subscribed")
        : t("body");

  const buttonLabel = !isSignedIn ? t("signIn") : isSubscribed ? t("unsubscribe") : t("cta");

  const button = (
    <button
      onClick={() => {
        if (isError) reset();
        void toggle();
      }}
      disabled={busy}
      style={{
        ...(promotional ? primaryButtonStyle : secondaryButtonStyle),
        ...(busy ? { opacity: 0.6, cursor: "not-allowed", pointerEvents: "none" } : null),
      }}
    >
      {busy ? "…" : isError ? t("retry") : buttonLabel}
    </button>
  );

  // Compact: lives inside ContentLanguageNotice's box — no card of its own, just a divider + row.
  if (compact) {
    return (
      <div
        id="notificaciones"
        style={{
          marginTop:      "18px",
          paddingTop:     "16px",
          borderTop:      "1px solid var(--border)",
          display:        "flex",
          flexWrap:       "wrap",
          gap:            "14px",
          alignItems:     "center",
          justifyContent: "space-between",
        }}
      >
        <p style={{ flex: "1 1 240px", minWidth: 0, margin: 0, fontSize: "0.875rem", lineHeight: 1.55, color: "var(--text-muted)" }}>
          {message}
        </p>
        {button}
      </div>
    );
  }

  return (
    <section
      id="notificaciones"
      style={{
        position:       "relative",
        overflow:       "hidden",
        marginTop:      "56px",
        padding:        "24px 30px",
        borderRadius:   "20px",
        border:         promotional ? "1px solid var(--green-mid)" : "1px solid var(--border-variant)",
        background:     promotional
          ? "linear-gradient(135deg, rgba(78,222,163,0.08) 0%, rgba(16,185,129,0.04) 100%)"
          : "var(--surface-container)",
        display:        "flex",
        flexWrap:       "wrap",
        gap:            "20px",
        alignItems:     "center",
        justifyContent: "space-between",
      }}
    >
      {promotional ? (
        <div
          aria-hidden="true"
          style={{
            position:      "absolute",
            bottom:        "-120px",
            left:          "50%",
            transform:     "translateX(-50%)",
            width:         "520px",
            height:        "240px",
            background:    "radial-gradient(circle at 50% 100%, rgba(78,222,163,0.10) 0%, rgba(19,19,21,0) 68%)",
            pointerEvents: "none",
          }}
        />
      ) : null}

      <p style={{ position: "relative", flex: "1 1 320px", minWidth: 0, margin: 0, fontSize: "0.9375rem", lineHeight: 1.6, color: "var(--text-muted)" }}>
        {message}
      </p>
      <div style={{ position: "relative" }}>{button}</div>
    </section>
  );
}
