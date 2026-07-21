"use client";

/**
 * BookingSidebar — left panel for all booking flows (lg:col-span-3)
 *
 * Supports two modes:
 *   - "pack":   shows session card + pack status (credits + progress bar) + cancellation notice
 *   - "single": shows session card + price + meta rows (meet, timezone, trust badges)
 *
 * Below lg the sidebar stacks above the calendar, so it collapses to a compact
 * summary strip: the session card only (name + duration + price/credits, laid
 * out in a single row). The panel title, trust/meta rows and cancellation note
 * are desktop-only — the calendar already surfaces the timezone when it differs
 * from the schedule's, and the rest is reassurance that costs a phone viewport
 * more than it gives back.
 */

import { useTranslations } from "next-intl";

interface BookingSidebarProps {
  mode:           "pack" | "single";
  sessionName:    string;
  duration:       string;
  price?:         string | null;
  packRemaining?: number;
  packTotal?:     number;
  isReschedule?:  boolean;
  userTz?:        string;
}

export default function BookingSidebar({
  mode,
  sessionName,
  duration,
  price,
  packRemaining = 0,
  packTotal     = 0,
  isReschedule  = false,
  userTz,
}: BookingSidebarProps) {
  const t = useTranslations("booking.sidebar");

  const progressPct =
    packTotal > 0 ? Math.min(100, (packRemaining / packTotal) * 100) : 0;

  return (
    <div className="lg:col-span-3">
      <div
        className="p-4 lg:p-8 rounded-xl lg:sticky"
        style={{
          background: "#1c1b1d",
          border: "1px solid rgba(255,255,255,0.05)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
          top: "112px",
        }}
      >
        <h2
          className="hidden lg:block font-headline text-xl mb-6"
          style={{ color: "#e5e1e4" }}
        >
          {t("title")}
        </h2>

        {/* Session card — single row below lg, stacked block on desktop */}
        <div
          className={`flex items-center lg:items-start gap-3 lg:gap-4 p-3 lg:p-4 rounded-lg ${
            mode === "pack" ? "mb-6 lg:mb-8" : "mb-0 lg:mb-8"
          }`}
          style={{ background: "#201f22" }}
        >
          <div
            className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(78,222,163,0.1)", color: "#4edea3" }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 flex items-center justify-between gap-3 lg:block">
            <div className="min-w-0">
              <p className="font-headline text-base lg:text-lg leading-tight" style={{ color: "#e5e1e4" }}>
                {sessionName}
              </p>
              <p className="text-sm mt-1" style={{ color: "#bbcabf" }}>
                {t("duration", { duration })}
              </p>
            </div>
            {mode === "single" && price && (
              <p
                className="font-headline text-xl lg:text-2xl lg:mt-2 shrink-0"
                style={{ color: "#4edea3", letterSpacing: "-0.02em" }}
              >
                {price}
              </p>
            )}
            {mode === "single" && !price && (
              <p className="text-sm lg:mt-1 font-semibold shrink-0" style={{ color: "#4edea3" }}>
                {t("free")}
              </p>
            )}
          </div>
        </div>

        {/* ── Pack mode: status + progress ── */}
        {mode === "pack" && (
          <div
            className="space-y-3 pt-6"
            style={{ borderTop: "1px solid #3c4a42" }}
          >
            <div className="flex justify-between items-center">
              <span
                className="text-xs font-label uppercase tracking-widest"
                style={{ color: "#bbcabf" }}
              >
                {isReschedule ? t("reschedule") : t("packActive")}
              </span>
              {!isReschedule && (
                <span
                  className="text-xs font-bold font-label"
                  style={{ color: "#4edea3" }}
                >
                  {t("packRemaining", { packRemaining, packTotal })}
                </span>
              )}
            </div>

            {!isReschedule && (
              <>
                <div
                  className="w-full h-2 rounded-full overflow-hidden"
                  style={{ background: "#353437" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progressPct}%`,
                      background: "#4edea3",
                      boxShadow: "0 0 10px rgba(78,222,163,0.6)",
                    }}
                  />
                </div>
                <p
                  className="leading-tight"
                  style={{ fontSize: "10px", color: "rgba(187,202,191,0.6)" }}
                >
                  {t("packDeductNote")}
                </p>
              </>
            )}

            {isReschedule && (
              <p className="text-xs" style={{ color: "#bbcabf" }}>
                {t("rescheduleNote")}
              </p>
            )}
          </div>
        )}

        {/* ── Single session meta rows ── */}
        {mode === "single" && (
          <div
            className="hidden lg:block space-y-3 pt-6"
            style={{ borderTop: "1px solid #3c4a42" }}
          >
            <div className="flex items-center gap-3 text-xs" style={{ color: "#bbcabf" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
              </svg>
              {t("zoomApp")}
            </div>

            {userTz && (
              <div className="flex items-center gap-3 text-xs" style={{ color: "#bbcabf" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                {userTz}
              </div>
            )}

            {[
              {
                label: t("realtimeSlots"),
                icon: (
                  <svg key="cal" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                ),
              },
              {
                label: t("securePayment"),
                icon: (
                  <svg key="lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                ),
              },
            ].map(({ label, icon }) => (
              <div key={label} className="flex items-center gap-3 text-xs" style={{ color: "#86948a" }}>
                {icon}
                {label}
              </div>
            ))}
          </div>
        )}

        {/* ── Pack mode: cancellation notice ── */}
        {mode === "pack" && !isReschedule && (
          <div
            className="hidden lg:flex mt-8 p-4 rounded-xl items-start gap-3"
            style={{
              background: "#0e0e10",
              border: "1px dashed #3c4a42",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="#4edea3"
              className="shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <p
              className="leading-relaxed"
              style={{ fontSize: "11px", color: "#bbcabf" }}
            >
              {t("cancelNote")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
