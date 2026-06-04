"use client";

import { useTranslations } from "next-intl";
import { COLORS } from "@/constants";
import GoogleSignInButton from "@/components/GoogleSignInButton";

interface SignInGateProps {
  /** Human-readable name of what the user was trying to do */
  actionLabel: string;
  /** If provided, Google OAuth will redirect back to this URL instead of "/".
   *  Used to preserve reschedule params across the OAuth round-trip. */
  callbackUrl?: string;
  onClose: () => void;
}

export default function SignInGate({ actionLabel, callbackUrl, onClose }: SignInGateProps) {
  const t = useTranslations("booking.signInGate");
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-gate-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        }}
      >
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5 text-xl"
          style={{ background: COLORS.brandMuted, color: COLORS.brand }}
          aria-hidden="true"
        >
          🔐
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
          style={{ color: COLORS.textSecondary }}
        >
          {t.rich("body", {
            actionLabel,
            highlight: (c) => (
              <span style={{ color: COLORS.textPrimary, fontWeight: 500 }}>{c}</span>
            ),
          })}
        </p>

        <GoogleSignInButton callbackUrl={callbackUrl ?? "/"} />

        {/* Cancel */}
        <button
          onClick={onClose}
          className="w-full mt-3 text-sm text-center transition-colors"
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
