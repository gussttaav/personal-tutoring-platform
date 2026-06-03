"use client";

/**
 * PostClassReview — shown in place of "Sesión finalizada" when a class ends.
 *
 * Faithful TSX port of the approved mockup (post-class-review.jsx). The demo
 * harness (Tweaks panel, App, replay link, class-context chip) is dropped and
 * the phase machine is wired to /api/reviews:
 *
 *   rating ──tap──> POST kind:"rating" ──> showGoogleReview ? google : comment
 *   comment ─send─> POST kind:"comment" ──> thanks   (skip ──> thanks)
 *   google  ─ok──> POST kind:"google" accept + open link ──> thanks
 *           ─no──> POST kind:"google" decline ──────────────> thanks
 *   thanks  ──> "Volver al inicio"
 *
 * Rating is persisted the instant a face is tapped, so skipping afterwards only
 * skips the comment. POSTs are fire-and-forward: a network blip never traps the
 * user — the flow advances regardless.
 */

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { GOOGLE_REVIEW_URL } from "@/constants";

// ── Brand constants (match the design system) ───────────────────────────────
const GREEN = "#4edea3";
const GREEN_ON = "#003824";
const TEXT = "#e5e1e4";
const TEXT_MUTED = "#bbcabf";
const TEXT_DIM = "#86948a";
const SURFACE = "#131315";
const BORDER = "rgba(255,255,255,0.06)";

type Phase = "rating" | "comment" | "google" | "thanks";

interface Rating {
  value:       number;
  emoji:       string;
  label:       string;
  placeholder: string;
}

const RATING_EMOJIS = ["😞", "😕", "😐", "🙂", "🤩"];

function initialsOf(name: string, fallback: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Student avatar ──────────────────────────────────────────────────────────
function StudentAvatar({ initials, avatarUrl }: { initials: string; avatarUrl?: string | null }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!avatarUrl && !imgFailed;

  return (
    <div style={{ position: "relative", width: 64, height: 64, animation: "pcrFadeUp 0.5s ease both" }}>
      <div
        style={{
          position: "absolute",
          inset: -8,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(78,222,163,0.22) 0%, rgba(78,222,163,0) 65%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          overflow: "hidden",
          background: showImage
            ? "transparent"
            : "radial-gradient(circle at 35% 30%, #4edea3 0%, #10b981 55%, #0a5d3f 100%)",
          border: "1px solid rgba(78,222,163,0.45)",
          boxShadow: "0 8px 28px -8px rgba(78,222,163,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: GREEN_ON,
          fontFamily: "Manrope, sans-serif",
          fontWeight: 800,
          fontSize: 22,
          letterSpacing: "-0.02em",
        }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={initials}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          initials
        )}
      </div>
    </div>
  );
}

// ── A single rating face button ─────────────────────────────────────────────
function FaceButton({
  rating, selected, hovered, onSelect, onHover, onLeave,
}: {
  rating:   Rating;
  selected: number | null;
  hovered:  number | null;
  onSelect: (v: number) => void;
  onHover:  (v: number) => void;
  onLeave:  () => void;
}) {
  const isActive = selected === rating.value;
  const isHovered = hovered === rating.value;
  const dim =
    (selected != null && !isActive) ||
    (selected == null && hovered != null && !isHovered);
  const lift = isActive || isHovered;

  return (
    <button
      type="button"
      aria-label={`${rating.value}/5: ${rating.label}`}
      onClick={() => onSelect(rating.value)}
      onMouseEnter={() => onHover(rating.value)}
      onMouseLeave={onLeave}
      onFocus={() => onHover(rating.value)}
      onBlur={onLeave}
      style={{
        all: "unset",
        cursor: "pointer",
        width: 64,
        height: 64,
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isActive
          ? "rgba(78,222,163,0.10)"
          : isHovered
          ? "rgba(255,255,255,0.04)"
          : "transparent",
        border: isActive
          ? "1px solid rgba(78,222,163,0.45)"
          : "1px solid rgba(255,255,255,0.04)",
        boxShadow: isActive ? "0 0 32px rgba(78,222,163,0.22)" : "none",
        transform: lift ? "scale(1.12)" : "scale(1)",
        opacity: dim ? 0.32 : 1,
        filter: dim ? "saturate(0.4)" : "none",
        transition:
          "transform 0.22s cubic-bezier(.34,1.4,.5,1), opacity 0.18s ease, filter 0.18s ease, background 0.18s ease, border-color 0.18s ease, box-shadow 0.22s ease",
      }}
    >
      <span
        style={{
          fontSize: 36,
          lineHeight: 1,
          filter: isActive
            ? "drop-shadow(0 2px 14px rgba(78,222,163,0.35))"
            : "drop-shadow(0 1px 6px rgba(0,0,0,0.5))",
          transition: "filter 0.2s ease",
        }}
      >
        {rating.emoji}
      </span>
    </button>
  );
}

// ── Rating row ──────────────────────────────────────────────────────────────
function RatingRow({ selected, onSelect, ratings }: { selected: number | null; onSelect: (v: number) => void; ratings: Rating[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div
      style={{ display: "flex", gap: 14, justifyContent: "center", padding: "8px 4px" }}
      onMouseLeave={() => setHovered(null)}
    >
      {ratings.map((r) => (
        <FaceButton
          key={r.value}
          rating={r}
          selected={selected}
          hovered={hovered}
          onSelect={onSelect}
          onHover={setHovered}
          onLeave={() => setHovered(null)}
        />
      ))}
    </div>
  );
}

// ── Dynamic label below faces ───────────────────────────────────────────────
function RatingLabel({ rating, ratings, tapToRate }: { rating: number | null; ratings: Rating[]; tapToRate: string }) {
  const text = rating
    ? ratings.find((r) => r.value === rating)?.label
    : tapToRate;
  return (
    <div
      key={text}
      style={{
        minHeight: 28,
        textAlign: "center",
        fontFamily: "Manrope, sans-serif",
        fontWeight: rating ? 700 : 500,
        fontSize: rating ? 17 : 14,
        color: rating ? TEXT : TEXT_DIM,
        letterSpacing: rating ? "-0.01em" : "0",
        animation: "pcrFadeIn 0.35s ease both",
        transition: "color 0.2s ease",
      }}
    >
      {text}
    </div>
  );
}

// ── Comment area (textarea + send) ──────────────────────────────────────────
function CommentArea({
  rating, value, onChange, onSubmit, onSkip, sending, ratings, privateLabel, submittingLabel, submitLabel, skipLabel,
}: {
  rating:          number;
  value:           string;
  onChange:        (v: string) => void;
  onSubmit:        () => void;
  onSkip:          () => void;
  sending:         boolean;
  ratings:         Rating[];
  privateLabel:    string;
  submittingLabel: string;
  submitLabel:     string;
  skipLabel:       string;
}) {
  const placeholder = ratings.find((r) => r.value === rating)?.placeholder || "";
  const taRef = useRef<HTMLTextAreaElement>(null);
  const hasText = value.trim().length > 0;

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [value]);

  useEffect(() => {
    const id = setTimeout(() => taRef.current?.focus(), 320);
    return () => clearTimeout(id);
  }, []);

  return (
    <div style={{ width: "100%", animation: "pcrFadeUp 0.45s 0.05s ease both" }}>
      <div
        style={{
          position: "relative",
          background: "rgba(255,255,255,0.025)",
          borderRadius: 18,
          padding: "18px 20px 14px",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04), 0 8px 28px rgba(0,0,0,0.25)",
          transition: "box-shadow 0.2s ease, background 0.2s ease",
        }}
      >
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            color: TEXT,
            fontFamily: "Inter, sans-serif",
            fontSize: 15,
            lineHeight: 1.6,
            minHeight: 56,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 4,
            paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11.5,
              color: TEXT_DIM,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: TEXT_DIM }}>
              lock
            </span>
            {privateLabel}
          </div>
          {hasText ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={sending}
              style={{
                all: "unset",
                cursor: sending ? "default" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 999,
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color: GREEN_ON,
                background: "linear-gradient(135deg, #4edea3, #10b981)",
                boxShadow: "0 6px 20px -6px rgba(78,222,163,0.55)",
                transition:
                  "opacity 0.25s ease, transform 0.25s ease, box-shadow 0.2s ease, background 0.2s ease",
                animation: "pcrFadeIn 0.2s ease both",
              }}
            >
              {sending ? submittingLabel : submitLabel}
              {!sending && (
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  arrow_forward
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSkip}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 999,
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                color: TEXT_DIM,
                transition: "color 0.15s ease, background 0.15s ease",
                animation: "pcrFadeIn 0.2s ease both",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = TEXT_MUTED;
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = TEXT_DIM;
                e.currentTarget.style.background = "transparent";
              }}
            >
              {skipLabel}
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                arrow_forward
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Animated check ──────────────────────────────────────────────────────────
function AnimatedCheck() {
  return (
    <div
      style={{
        position: "relative",
        width: 84,
        height: 84,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "pcrFadeIn 0.3s ease both",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "rgba(78,222,163,0.10)",
          boxShadow: "0 0 60px rgba(78,222,163,0.35)",
          animation: "pcrPulse 1.8s ease-out 0.4s both",
        }}
      />
      <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
        <circle
          cx="42"
          cy="42"
          r="34"
          stroke={GREEN}
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            strokeDasharray: 220,
            strokeDashoffset: 220,
            animation: "pcrDraw 0.55s 0.05s cubic-bezier(.65,0,.35,1) forwards",
            transformOrigin: "center",
            transform: "rotate(-90deg)",
          }}
        />
        <path
          d="M27 43 L38 54 L58 33"
          stroke={GREEN}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 60,
            strokeDashoffset: 60,
            animation: "pcrDraw 0.35s 0.5s cubic-bezier(.65,0,.35,1) forwards",
          }}
        />
      </svg>
    </div>
  );
}

// ── Google review card ──────────────────────────────────────────────────────
function GooglePrompt({ onAccept, onDecline, shareGoogle, shareGoogleBody, leaveReview, noThanks }: {
  onAccept: () => void;
  onDecline: () => void;
  shareGoogle: string;
  shareGoogleBody: string;
  leaveReview: string;
  noThanks: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 460,
        marginTop: 24,
        padding: "20px 22px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid " + BORDER,
        borderRadius: 18,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        animation: "pcrFadeUp 0.5s ease both",
        boxShadow: "0 12px 36px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid " + BORDER,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "Manrope, sans-serif",
              fontSize: 16,
              fontWeight: 700,
              color: TEXT,
              letterSpacing: "-0.01em",
              marginBottom: 4,
            }}
          >
            {shareGoogle}
          </div>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 13.5,
              color: TEXT_MUTED,
              lineHeight: 1.55,
            }}
          >
            {shareGoogleBody}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={onAccept}
          style={{
            all: "unset",
            cursor: "pointer",
            flex: 1,
            textAlign: "center",
            padding: "11px 16px",
            borderRadius: 10,
            background: "linear-gradient(135deg, #4edea3, #10b981)",
            color: GREEN_ON,
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            fontSize: 13.5,
            boxShadow: "0 8px 24px -8px rgba(78,222,163,0.55)",
            transition: "filter 0.15s ease, transform 0.15s ease",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
        >
          {leaveReview}
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            open_in_new
          </span>
        </button>
        <button
          type="button"
          onClick={onDecline}
          style={{
            all: "unset",
            cursor: "pointer",
            padding: "11px 14px",
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            color: TEXT_DIM,
            transition: "color 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = TEXT_MUTED)}
          onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_DIM)}
        >
          {noThanks}
        </button>
      </div>
    </div>
  );
}

// ── Skip / Continue link ────────────────────────────────────────────────────
function SkipLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        fontFamily: "Inter, sans-serif",
        fontSize: 13,
        color: TEXT_DIM,
        padding: "8px 14px",
        borderRadius: 999,
        transition: "color 0.15s ease, background 0.15s ease",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = TEXT_MUTED;
        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = TEXT_DIM;
        e.currentTarget.style.background = "transparent";
      }}
    >
      {label}
      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
        arrow_forward
      </span>
    </button>
  );
}

// ── Backdrop (orb + grid) ───────────────────────────────────────────────────
function Backdrop() {
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: SURFACE, zIndex: 0 }} />
      <div
        style={{
          position: "fixed",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "120%",
          height: "85vh",
          background:
            "radial-gradient(ellipse at 50% -10%, rgba(78,222,163,0.18) 0%, rgba(19,19,21,0) 55%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
    </>
  );
}

// Local keyframes — namespaced so they don't collide with global animations.
const KEYFRAMES = `
@keyframes pcrFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pcrFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes pcrDraw   { to { stroke-dashoffset: 0; } }
@keyframes pcrPulse  { 0% { transform: scale(0.6); opacity: 0.6; } 70% { transform: scale(1.4); opacity: 0; } 100% { transform: scale(1.4); opacity: 0; } }
`;

async function postReview(body: unknown): Promise<{ showGoogleReview?: boolean } | null> {
  try {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as { showGoogleReview?: boolean } | null;
  } catch {
    // Network blip — never trap the user; the flow advances regardless.
    return null;
  }
}

export interface PostClassReviewProps {
  eventId:        string;
  userName:       string;
  userAvatarUrl?: string | null;
}

export default function PostClassReview({ eventId, userName, userAvatarUrl }: PostClassReviewProps) {
  const t = useTranslations("postClassReview");
  const [phase, setPhase] = useState<Phase>("rating");
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const initials = initialsOf(userName, t("initials"));

  const rawRatings = t.raw("ratings") as { label: string; placeholder: string }[];
  const ratings: Rating[] = rawRatings.map((r, i) => ({
    value: i + 1,
    emoji: RATING_EMOJIS[i]!,
    label: r.label,
    placeholder: r.placeholder,
  }));

  const handleSelect = (v: number) => {
    setRating(v);
    // Render the comment area immediately so the inline skip takes over the
    // moment the global "Saltar" hides — no blank gap while the POST is in
    // flight. If the server later says showGoogleReview, swap to the Google
    // card only if the user hasn't started typing (so we don't discard input).
    setPhase("comment");
    void postReview({ kind: "rating", eventId, rating: v }).then((res) => {
      if (!res?.showGoogleReview) return;
      setComment((current) => {
        if (current.trim().length === 0) setPhase("google");
        return current;
      });
    });
  };

  const handleSubmitComment = () => {
    setSending(true);
    void postReview({ kind: "comment", eventId, comment }).then(() => {
      setSending(false);
      setPhase("thanks");
    });
  };

  const handleGoogleAccept = () => {
    void postReview({ kind: "google", action: "accept" });
    window.open(GOOGLE_REVIEW_URL, "_blank", "noopener,noreferrer");
    setPhase("thanks");
  };

  const handleGoogleDecline = () => {
    void postReview({ kind: "google", action: "decline" });
    setPhase("thanks");
  };

  const goToPersonalArea = () => {
    window.location.href = "/area-personal";
  };

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "auto" }}>
      <style>{KEYFRAMES}</style>
      <Backdrop />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "min(8vh, 64px) 24px 32px",
          boxSizing: "border-box",
        }}
      >
        <div aria-hidden style={{ height: 1 }} />

        <div
          style={{
            flex: "1 1 auto",
            width: "100%",
            maxWidth: 560,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            padding: "32px 0",
          }}
        >
          {(phase === "rating" || phase === "comment") && (
            <>
              <StudentAvatar initials={initials} avatarUrl={userAvatarUrl} />
              <div
                style={{
                  fontFamily: "Manrope, sans-serif",
                  fontSize: "clamp(26px, 4.6vw, 38px)",
                  fontWeight: 800,
                  lineHeight: 1.15,
                  letterSpacing: "-0.025em",
                  color: TEXT,
                  textAlign: "center",
                  margin: 0,
                  animation: "pcrFadeUp 0.55s ease both",
                }}
              >
                {t("title")}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 14,
                  animation: "pcrFadeUp 0.6s 0.1s ease both",
                }}
              >
                <RatingRow selected={rating} onSelect={handleSelect} ratings={ratings} />
                <RatingLabel rating={rating} ratings={ratings} tapToRate={t("tapToRate")} />
              </div>

              {phase === "comment" && rating != null && (
                <CommentArea
                  rating={rating}
                  value={comment}
                  onChange={setComment}
                  onSubmit={handleSubmitComment}
                  onSkip={() => setPhase("thanks")}
                  sending={sending}
                  ratings={ratings}
                  privateLabel={t("private")}
                  submittingLabel={t("submitting")}
                  submitLabel={t("submit")}
                  skipLabel={t("skip")}
                />
              )}
            </>
          )}

          {phase === "google" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
              <StudentAvatar initials={initials} avatarUrl={userAvatarUrl} />
              <div
                style={{
                  fontFamily: "Manrope, sans-serif",
                  fontSize: "clamp(24px, 4vw, 32px)",
                  fontWeight: 800,
                  color: TEXT,
                  letterSpacing: "-0.025em",
                  lineHeight: 1.15,
                  margin: 0,
                  textAlign: "center",
                  animation: "pcrFadeUp 0.5s ease both",
                }}
              >
                {t("goodTitle")}
              </div>
              <GooglePrompt
                onAccept={handleGoogleAccept}
                onDecline={handleGoogleDecline}
                shareGoogle={t("shareGoogle")}
                shareGoogleBody={t("shareGoogleBody")}
                leaveReview={t("leaveReview")}
                noThanks={t("noThanks")}
              />
            </div>
          )}

          {phase === "thanks" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
              <AnimatedCheck />
              <div
                style={{
                  fontFamily: "Manrope, sans-serif",
                  fontSize: "clamp(26px, 4.4vw, 36px)",
                  fontWeight: 800,
                  color: TEXT,
                  letterSpacing: "-0.025em",
                  lineHeight: 1.15,
                  margin: 0,
                  animation: "pcrFadeUp 0.45s 0.25s ease both",
                }}
              >
                {t("thanks")}
              </div>
              <div
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 15,
                  color: TEXT_MUTED,
                  maxWidth: 380,
                  textAlign: "center",
                  lineHeight: 1.55,
                  margin: 0,
                  animation: "pcrFadeUp 0.45s 0.35s ease both",
                }}
              >
                {t("thanksBody")}
              </div>
              <button
                type="button"
                onClick={goToPersonalArea}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  marginTop: 4,
                  padding: "12px 22px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #4edea3, #10b981)",
                  color: GREEN_ON,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  boxShadow: "0 8px 24px -8px rgba(78,222,163,0.55)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "filter 0.15s ease",
                  animation: "pcrFadeUp 0.45s 0.45s ease both",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
                  login
                </span>
                {t("toPersonalArea")}
              </button>
            </div>
          )}
        </div>

        <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {phase === "rating" && (
            <SkipLink label={t("skip")} onClick={() => setPhase("thanks")} />
          )}
          {phase === "google" && (
            <SkipLink label={t("continueNoReview")} onClick={handleGoogleDecline} />
          )}
        </div>
      </div>
    </div>
  );
}
