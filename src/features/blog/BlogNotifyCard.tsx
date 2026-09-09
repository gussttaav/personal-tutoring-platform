"use client";

/*
 * BLOG-01 — "notify me about new posts".
 *
 * Replaces what the ComingSoonModal used to be for the blog. The modal was a dead end
 * that happened to collect an email; this is an opt-in sitting under real articles,
 * which is the only context in which asking is reasonable. Same reasoning, and the same
 * shape, as `CourseNotifyCard` after COURSE-P6-02.
 *
 * The `blog` subscription type already existed end to end before this page did:
 * `SubscriptionType` (src/domain/types.ts), `SubscribeSchema` (src/lib/schemas.ts), the
 * CHECK constraint in supabase/migrations/0002_subscriptions.sql, and /api/subscribe.
 * Nothing here is new plumbing; only the surface is.
 *
 * It is a toggle, not a one-way button, so the announce email's unsubscribe link has
 * somewhere to point — no token infrastructure needed, because subscribing requires a
 * signed-in account.
 *
 * Deliberately NOT a shared component with `CourseNotifyCard`: that one carries a
 * `compact` variant for the course landing's language notice, which this surface has no
 * use for. Extracting the common card is a worthwhile follow-up, not a drive-by.
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

export default function BlogNotifyCard() {
  const t = useTranslations("blog.notify");
  const { state, busy, isSignedIn, toggle, reset } = useSubscription("blog");

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

      <p
        style={{
          position: "relative",
          flex:     "1 1 320px",
          minWidth: 0,
          margin:   0,
          fontSize: "0.9375rem",
          lineHeight: 1.6,
          color:    "var(--text-muted)",
        }}
      >
        {message}
      </p>

      <div style={{ position: "relative" }}>
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
      </div>
    </section>
  );
}
