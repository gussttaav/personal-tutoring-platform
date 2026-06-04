"use client";

import { type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { COLORS } from "@/constants";

/**
 * feedback.tsx — Emerald Nocturne feedback primitives
 *
 * Shared building blocks for full-page feedback/result screens
 * (/cancelar, /pago-exitoso): atmosphere shell, halo icon, eyebrow pill,
 * title/body typography, info card, buttons and helper footer.
 *
 * Colours come from the COLORS tokens (which already map 1:1 to the
 * design's CSS vars). The `neutral` tone uses literal translucent white
 * per the mockup, since there is no equivalent token.
 */

export type FeedbackTone = "success" | "warning" | "error" | "neutral";

export const TONE: Record<FeedbackTone, { color: string; bg: string; border: string }> = {
  success: { color: COLORS.brand,         bg: COLORS.successBg,        border: COLORS.successBorder },
  warning: { color: COLORS.warning,       bg: COLORS.warningBg,        border: COLORS.warningBorder },
  error:   { color: COLORS.error,         bg: COLORS.errorBg,          border: COLORS.errorBorder },
  neutral: { color: COLORS.textSecondary, bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.10)" },
};

/** Radial emerald glow over the base background — the page "atmosphere". */
export const ATMOSPHERE_BG =
  `radial-gradient(ellipse at 50% -10%, rgba(78,222,163,0.14) 0%, rgba(19,19,21,0) 55%), ${COLORS.background}`;

// ─── Page shell ─────────────────────────────────────────────────────────────

/** The feedback card box (no page chrome). Use inside any layout. */
export function FeedbackCard({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-col gap-3 p-5 sm:gap-5 sm:p-7"
      style={{
        position: "relative", width: "100%", maxWidth: 480,
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 16,
        boxShadow: "0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.03)",
      }}
    >
      {children}
    </div>
  );
}

/** Full-page feedback screen: atmosphere background + centered card. */
export function FeedbackMain({ children }: { children: ReactNode }) {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-2 py-6 sm:px-6"
      style={{ background: ATMOSPHERE_BG }}
    >
      <FeedbackCard>{children}</FeedbackCard>
    </main>
  );
}

// ─── Icon halo ──────────────────────────────────────────────────────────────

export function IconHalo({
  tone, glyph, spinner = false,
}: {
  tone: FeedbackTone;
  glyph?: string;
  spinner?: boolean;
}) {
  const t = TONE[tone];
  return (
    <div className="relative mx-auto" style={{ width: 64, height: 64 }} aria-hidden="true">
      <span
        style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: `1px solid ${t.border}`, background: t.bg,
        }}
      />
      <span
        style={{
          position: "absolute", inset: 10, borderRadius: "50%",
          background: t.bg, border: `1px solid ${t.border}`, color: t.color,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 50px ${t.bg}, 0 0 0 1px ${t.border} inset`,
        }}
      >
        {spinner ? (
          <span
            className="rounded-full border-2 animate-spin"
            style={{
              width: 24, height: 24,
              borderColor: t.border, borderTopColor: COLORS.brand,
            }}
          />
        ) : (
          <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
            {glyph}
          </span>
        )}
      </span>
    </div>
  );
}

// ─── Eyebrow pill ───────────────────────────────────────────────────────────

export function Eyebrow({ tone, children }: { tone: FeedbackTone; children: ReactNode }) {
  const t = TONE[tone];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "center",
        padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700,
        letterSpacing: "0.14em", textTransform: "uppercase", lineHeight: 1,
        color: t.color, background: t.bg, border: `1px solid ${t.border}`,
      }}
    >
      <span
        className={tone === "neutral" ? "animate-pulse" : undefined}
        style={{
          width: 5, height: 5, borderRadius: "50%",
          background: t.color,
          boxShadow: tone === "neutral" ? undefined : `0 0 8px ${t.color}`,
        }}
      />
      {children}
    </span>
  );
}

// ─── Typography ─────────────────────────────────────────────────────────────

export function FbTitle({ children }: { children: ReactNode }) {
  return (
    <h1
      style={{
        fontFamily: "var(--font-headline)",
        fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em",
        lineHeight: 1.18, color: COLORS.textPrimary, textAlign: "center",
        margin: 0, textWrap: "balance",
      }}
    >
      {children}
    </h1>
  );
}

export function FbBody({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize: 14, lineHeight: 1.55, color: COLORS.textSecondary,
        textAlign: "center", margin: 0,
      }}
    >
      {children}
    </p>
  );
}

/** Centered eyebrow + title + body group. */
export function HeaderBlock({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: 8 }}>
      {children}
    </div>
  );
}

// ─── Info card ──────────────────────────────────────────────────────────────

export function InfoBox({
  tone, children,
}: {
  tone?: FeedbackTone;
  children: ReactNode;
}) {
  const tinted = tone && tone !== "neutral";
  return (
    <div
      style={{
        background: tinted ? TONE[tone].bg : COLORS.background,
        border: `1px solid ${tinted ? TONE[tone].border : COLORS.border}`,
        borderRadius: 11, padding: "14px 15px",
        display: "flex", flexDirection: "column", gap: 10, fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

export function InfoRow({
  glyph, tone, children,
}: {
  glyph: string;
  tone?: FeedbackTone;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        color: COLORS.textSecondary, lineHeight: 1.5,
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{
          fontSize: 17, flexShrink: 0, marginTop: 1,
          color: tone && tone !== "neutral" ? TONE[tone].color : COLORS.textMuted,
        }}
        aria-hidden="true"
      >
        {glyph}
      </span>
      <div>{children}</div>
    </div>
  );
}

// ─── Buttons ────────────────────────────────────────────────────────────────

const BTN_BASE: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  gap: 8, height: 44, padding: "0 14px", borderRadius: 10, minWidth: 0,
  fontFamily: "inherit", fontSize: 14, fontWeight: 600,
  border: "1px solid transparent", whiteSpace: "nowrap",
  transition: "filter 0.15s ease, border-color 0.15s ease, background 0.15s ease, color 0.15s ease",
};

export type FbButtonVariant = "primary" | "danger" | "ghost" | "disabled";

export function FbButton({
  variant, onClick, children, style,
}: {
  variant: FbButtonVariant;
  onClick?: () => void;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  const isDisabled = variant === "disabled";
  const variantStyle: Record<FbButtonVariant, React.CSSProperties> = {
    primary: {
      background: `linear-gradient(135deg, ${COLORS.brand}, #10b981)`,
      color: "#003824", fontWeight: 700,
      boxShadow: `0 8px 24px -8px ${COLORS.brandBorder}`,
    },
    danger: {
      background: COLORS.errorBg, borderColor: COLORS.errorBorder, color: COLORS.error,
    },
    ghost: {
      background: "transparent",
      borderColor: "rgba(255,255,255,0.10)", color: COLORS.textSecondary,
    },
    disabled: {
      background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.06)",
      color: COLORS.textMuted,
    },
  };
  return (
    <button
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      style={{
        ...BTN_BASE, ...variantStyle[variant],
        cursor: isDisabled ? "not-allowed" : "pointer",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (isDisabled) return;
        const el = e.currentTarget as HTMLElement;
        if (variant === "primary") el.style.filter = "brightness(1.06)";
        else if (variant === "danger") el.style.background = "rgba(255,180,171,0.20)";
        else { el.style.borderColor = "rgba(255,255,255,0.20)"; el.style.color = COLORS.textPrimary; }
      }}
      onMouseLeave={(e) => {
        if (isDisabled) return;
        const el = e.currentTarget as HTMLElement;
        if (variant === "primary") el.style.filter = "none";
        else if (variant === "danger") el.style.background = COLORS.errorBg;
        else { el.style.borderColor = "rgba(255,255,255,0.10)"; el.style.color = COLORS.textSecondary; }
      }}
    >
      {children}
    </button>
  );
}

/** Three blinking dots — used inside a disabled "waiting" button. */
export function LoadingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[0, 0.2, 0.4].map((d) => (
        <span
          key={d}
          className="animate-pulse"
          style={{
            width: 4, height: 4, borderRadius: "50%",
            background: COLORS.textMuted, animationDelay: `${d}s`,
          }}
        />
      ))}
    </span>
  );
}

// ─── Confirmation checklist (shared across success screens) ─────────────────

const CHECK_BOLD: React.CSSProperties = { color: COLORS.textPrimary, fontWeight: 600 };

/** Canonical "what to expect" checklist — keep both success screens in sync. */
export function ConfirmationChecklist() {
  const t = useTranslations("feedback");
  const rows: { glyph: string; node: ReactNode }[] = [
    { glyph: "mail",           node: t.rich("emailRow",       { bold: (c) => <b style={CHECK_BOLD}>{c}</b> }) },
    { glyph: "event_available", node: t.rich("calendarRow",   { bold: (c) => <b style={CHECK_BOLD}>{c}</b> }) },
    { glyph: "manage_accounts", node: t.rich("personalAreaRow", { bold: (c) => <b style={CHECK_BOLD}>{c}</b> }) },
  ];
  return (
    <div
      style={{
        background: COLORS.background, border: `1px solid ${COLORS.border}`,
        borderRadius: 11, padding: "4px 14px", display: "flex", flexDirection: "column",
      }}
    >
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 0",
            borderBottom: i < rows.length - 1 ? `1px solid ${COLORS.border}` : "none",
            fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 1.5,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 16, color: COLORS.brand, flexShrink: 0, marginTop: 1 }}
            aria-hidden="true"
          >
            {r.glyph}
          </span>
          <span>{r.node}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Steps list (diagnostic progress) ───────────────────────────────────────

export type StepState = "done" | "load" | "wait";

export function Step({
  glyph, label, state, last = false,
}: {
  glyph: string;
  label: string;
  state: StepState;
  last?: boolean;
}) {
  const done = state === "done";
  const load = state === "load";
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 0",
        borderBottom: last ? "none" : `1px solid ${COLORS.border}`, fontSize: 13,
        color: state === "wait" ? COLORS.textMuted : COLORS.textPrimary,
      }}
    >
      <span
        className={`material-symbols-outlined ${load ? "animate-spin" : ""}`}
        style={{
          width: 22, height: 22, borderRadius: "50%", fontSize: 14,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          background: done || load ? COLORS.successBg : "rgba(255,255,255,0.04)",
          color: done || load ? COLORS.brand : COLORS.textMuted,
        }}
        aria-hidden="true"
      >
        {glyph}
      </span>
      <span>{label}</span>
    </div>
  );
}

export function Steps({ items }: { items: { glyph: string; label: string; state: StepState }[] }) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column",
        background: COLORS.background, border: `1px solid ${COLORS.border}`,
        borderRadius: 11, padding: "0 14px",
      }}
    >
      {items.map((it, i) => (
        <Step key={i} {...it} last={i === items.length - 1} />
      ))}
    </div>
  );
}

// ─── Helper footer ──────────────────────────────────────────────────────────

export function Helper({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        paddingTop: 14, borderTop: `1px solid ${COLORS.border}`,
        fontSize: 12, color: COLORS.textMuted, textAlign: "center", lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

/** Small inline Material glyph sized for body/helper text. */
export function MiniIcon({ glyph, size = 13 }: { glyph: string; size?: number }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: size, verticalAlign: -2, marginRight: 4, color: COLORS.textMuted }}
      aria-hidden="true"
    >
      {glyph}
    </span>
  );
}
