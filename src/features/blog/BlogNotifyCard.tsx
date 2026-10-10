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
 *
 * BLOG-15: the reader picks the AREAS they want to hear about. Signed in, the card shows
 * one toggle per `BLOG_AREAS` entry (every area, not only the ones a published post uses:
 * the opt-in is about posts still to come). Before subscribing they are a draft, all on,
 * sent with «Notifícame». Once subscribed they are a draft too: as soon as it differs from
 * the saved selection, «No recibir notificaciones» gives way to «Actualizar suscripción»
 * (PATCH) and «Descartar cambios»; toggling back to the saved selection brings the
 * unsubscribe button back. At least one area always stays on. The toggles wait for the
 * status read, so a subscriber never sees the draft flash first.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSubscription } from "@/hooks/useSubscription";
import { BLOG_AREAS, BLOG_AREA_ICONS } from "@/constants/blog";
import { expandBlogAreas, sameBlogAreas } from "@/lib/blog/subscription-areas";
import type { BlogArea } from "@/domain/types";

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

// BLOG-15: «Descartar cambios» — quieter than the secondary button, it is the way back.
const discardButtonStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: "12px 6px",
  background: "transparent",
  color: "var(--text-muted)",
  border: "none",
  fontFamily: "var(--font-headline, Manrope), sans-serif",
  fontWeight: 600,
  fontSize: "0.875rem",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
  cursor: "pointer",
};

const busyStyle: React.CSSProperties = { opacity: 0.6, cursor: "not-allowed", pointerEvents: "none" };

type Notice = "lastArea" | "saved" | "saveError";

export default function BlogNotifyCard() {
  const t = useTranslations("blog.notify");
  const tArea = useTranslations("blog.areas");
  const {
    state, busy, isSignedIn, statusKnown, areas, savingAreas,
    toggle, updateAreas, reset,
  } = useSubscription("blog");

  // The selection before subscribing; every area until the reader says otherwise.
  const [draft, setDraft] = useState<BlogArea[]>([...BLOG_AREAS]);
  // A subscriber's unsaved selection; `null` while it matches what is saved.
  const [edits, setEdits] = useState<BlogArea[] | null>(null);
  // The line under the toggles; cleared by the reader's next change.
  const [notice, setNotice] = useState<Notice | null>(null);

  const isSubscribed = state === "subscribed";
  const isError      = state === "error";
  // The invitation states wear the CTA card + primary button; subscribed goes quiet.
  const promotional  = !isSubscribed;

  const showAreas = isSignedIn && statusKnown && !isError;
  const selected  = isSubscribed ? edits ?? expandBlogAreas(areas) : draft;
  // Only a subscriber has something to update; `edits` is reset to null when it matches.
  const dirty     = isSubscribed && edits !== null;
  const areasLocked = busy || savingAreas;

  const toggleArea = (area: BlogArea) => {
    if (areasLocked) return;
    const on = selected.includes(area);
    if (on && selected.length === 1) {
      setNotice("lastArea");
      return;
    }
    setNotice(null);
    const next = BLOG_AREAS.filter((a) => (a === area ? !on : selected.includes(a)));
    if (isSubscribed) setEdits(sameBlogAreas(next, areas) ? null : next);
    else setDraft(next);
  };

  const saveAreas = async () => {
    if (!edits) return;
    const result = await updateAreas(edits);
    if (result === "failed") {
      setNotice("saveError");
      return;
    }
    // Saved, or the subscription was gone (the card is back to the invitation).
    setEdits(null);
    setNotice(result === "saved" ? "saved" : null);
  };

  const discardEdits = () => {
    setEdits(null);
    setNotice(null);
  };

  const areaHint = notice === "saveError"
    ? t("saveError")
    : notice === "saved"
      ? t("saved")
      : notice === "lastArea"
        // The unsubscribe hint only makes sense while that button is the one on screen.
        ? (isSubscribed && !dirty ? t("lastAreaHint") : t("pickOne"))
        : null;

  const message = isError
    ? t("error")
    : !isSignedIn
      ? t("signInHint")
      : isSubscribed
        ? (dirty ? t("pendingChanges") : t("subscribed"))
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

      <div style={{ position: "relative", flex: "1 1 320px", minWidth: 0 }}>
        <p
          style={{
            margin:   0,
            fontSize: "0.9375rem",
            lineHeight: 1.6,
            color:    "var(--text-muted)",
          }}
        >
          {message}
        </p>

        {showAreas ? (
          <div className="blog-notify-areas">
            <span className="blog-notify-areas__label" aria-hidden="true">{t("areasLabel")}</span>
            <div className="blog-notify-areas__toggles" role="group" aria-label={t("areasGroup")}>
              {BLOG_AREAS.map((area) => {
                const on = selected.includes(area);
                const icon = BLOG_AREA_ICONS[area];
                return (
                  <button
                    key={area}
                    type="button"
                    className="blog-tab blog-notify-area"
                    aria-pressed={on}
                    aria-disabled={areasLocked || undefined}
                    onClick={() => toggleArea(area)}
                  >
                    <span className="material-symbols-outlined blog-area-icon" data-area={area} aria-hidden="true">
                      {icon}
                    </span>
                    {tArea(area)}
                  </button>
                );
              })}
            </div>
            {areaHint ? (
              <p className="blog-notify-areas__hint" role="status">{areaHint}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div style={{ position: "relative", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
        {dirty ? (
          <>
            <button
              type="button"
              onClick={discardEdits}
              disabled={savingAreas}
              style={{ ...discardButtonStyle, ...(savingAreas ? busyStyle : null) }}
            >
              {t("discard")}
            </button>
            <button
              type="button"
              onClick={() => void saveAreas()}
              disabled={savingAreas}
              style={{ ...primaryButtonStyle, ...(savingAreas ? busyStyle : null) }}
            >
              {savingAreas ? "…" : t("update")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (isError) reset();
              setNotice(null);
              void toggle({ areas: draft });
            }}
            disabled={busy}
            style={{
              ...(promotional ? primaryButtonStyle : secondaryButtonStyle),
              ...(busy ? busyStyle : null),
            }}
          >
            {busy ? "…" : isError ? t("retry") : buttonLabel}
          </button>
        )}
      </div>
    </section>
  );
}
