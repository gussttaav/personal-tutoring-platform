"use client";

import { useTranslations } from "next-intl";
import { COLORS } from "@/constants";
import GoogleSignInButton from "@/components/GoogleSignInButton";

interface SignInGateProps {
  /** Translation key (relative to `booking.signInGate.actions`) describing what
   *  the user was trying to do, e.g. "actions.book1h". Resolved here so the copy
   *  follows the active locale. */
  actionLabel: string;
  /** If provided, Google OAuth will redirect back to this URL instead of "/".
   *  Used to preserve reschedule params across the OAuth round-trip. */
  callbackUrl?: string;
  onClose: () => void;
}

export default function SignInGate({ actionLabel, callbackUrl, onClose }: SignInGateProps) {
  const t = useTranslations("booking.signInGate");
  // actionLabel is a translation key (e.g. "actions.book1h"), not literal copy.
  const action = t(actionLabel);
  return (
    <div
      className="signin-gate-overlay fixed inset-0 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-gate-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="signin-gate-card w-full max-w-sm rounded-2xl p-8"
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
        }}
      >
        {/* Icon */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{
            background: COLORS.brandMuted,
            border: `1px solid ${COLORS.brandBorder}`,
            color: COLORS.brand,
          }}
          aria-hidden="true"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
            <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
            <circle cx="12" cy="15.5" r="1.25" fill="currentColor" stroke="none" />
          </svg>
        </div>

        {/* Title */}
        <h2
          id="signin-gate-title"
          className="text-center text-lg font-semibold mb-2"
          style={{ color: COLORS.textPrimary }}
        >
          {t("title")}
        </h2>

        {/* Description */}
        <p
          className="text-center text-sm mb-6"
          style={{ color: COLORS.textSecondary, lineHeight: 1.55 }}
        >
          {t.rich("body", {
            actionLabel: action,
            highlight: (c) => (
              <span style={{ color: COLORS.textPrimary, fontWeight: 500 }}>{c}</span>
            ),
          })}
        </p>

        <GoogleSignInButton callbackUrl={callbackUrl ?? "/"} label={t("continueGoogle")} />

        {/* Cancel */}
        <button
          onClick={onClose}
          className="w-full mt-3 py-2 text-sm text-center rounded-lg transition-colors"
          style={{ color: COLORS.textMuted, background: "none", border: "none", cursor: "pointer" }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.color = COLORS.textSecondary)
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.color = COLORS.textMuted)
          }
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
