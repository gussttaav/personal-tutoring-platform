"use client";

/*
 * COURSE-P6-02 — "notify me about new courses".
 *
 * Replaces what the ComingSoonModal used to be for courses. The modal was a dead end that
 * happened to collect an email; this is an opt-in sitting under real content, which is the
 * only context in which asking is reasonable.
 *
 * ONE subscription (`type: "courses"`) means "new courses and major updates". There is no
 * separate "tell me when English lands" flag on purpose: sends resolve language from
 * `users.locale`, so an English subscriber IS the audience for that announcement already.
 *
 * It is a toggle, not a one-way button, and that is the unsubscribe path the announce email
 * links to — no token infrastructure needed, because subscribing requires a signed-in account.
 */

import { useTranslations } from "next-intl";
import { useSubscription } from "@/hooks/useSubscription";

export default function CourseNotifyCard({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("courses.notify");
  const { state, busy, isSignedIn, toggle, reset } = useSubscription("courses");

  const isSubscribed = state === "subscribed";
  const isError      = state === "error";

  const buttonLabel = !isSignedIn ? t("signIn") : isSubscribed ? t("unsubscribe") : t("cta");

  return (
    <section
      id="notificaciones"
      style={{
        marginTop:    compact ? "20px" : "56px",
        padding:      compact ? "20px" : "28px 32px",
        background:   "var(--surface-container)",
        border:       "1px solid var(--border-variant)",
        borderRadius: "16px",
        display:        "flex",
        flexWrap:       "wrap",
        gap:            "20px",
        alignItems:     "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ flex: "1 1 300px", minWidth: 0 }}>
        <h2
          style={{
            fontFamily: "var(--font-headline, Manrope), sans-serif",
            fontSize:   compact ? "1rem" : "1.125rem",
            fontWeight: 700,
            color:      "var(--text)",
            margin:     "0 0 6px",
          }}
        >
          {isSubscribed ? t("subscribed") : t("heading")}
        </h2>
        <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.6, color: "var(--text-muted)" }}>
          {isError ? t("error") : !isSignedIn ? t("signInHint") : t("body")}
        </p>
      </div>

      <button
        onClick={() => { if (isError) reset(); void toggle(); }}
        disabled={busy}
        style={{
          flexShrink:    0,
          padding:       "12px 22px",
          borderRadius:  "12px",
          border:        isSubscribed ? "1px solid var(--border-variant)" : "none",
          background:    isSubscribed ? "transparent" : busy ? "var(--green-mid)" : "var(--green)",
          color:         isSubscribed ? "var(--text-muted)" : "#131315",
          fontSize:      "0.875rem",
          fontWeight:    700,
          fontFamily:    "var(--font-headline, Manrope), sans-serif",
          cursor:        busy ? "not-allowed" : "pointer",
          pointerEvents: busy ? "none" : "auto",
        }}
      >
        {busy ? "…" : isError ? t("retry") : buttonLabel}
      </button>
    </section>
  );
}
