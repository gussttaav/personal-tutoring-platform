"use client";

/**
 * FooterModals — Emerald Nocturne reskin
 *
 * Behaviour: IDENTICAL to original — opens policy modals on click.
 * Change: link styling updated to new design tokens.
 * The modal overlay itself is also reskinned to use surface-container-highest + backdrop-blur.
 *
 * Used by: Footer.tsx (new), and still works standalone if needed.
 *
 * REFACTOR-R4-P2-03: rendered on EVERY page (via Footer), but the commerce providers
 * are now mounted only by the booking pages. The two numbers the cancellation/terms
 * copy quotes come from `usePolicyNumbers`: the context when CommerceProviders is
 * mounted (no request), else a one-off fetch of the static `/api/policy` the first
 * time one of those two modals opens, with a short skeleton until it answers.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  CancelacionContent,
  TerminosContent,
  PrivacidadContent,
  type PolicyNumbers,
} from "@/components/policy/PolicyContent";
import { usePackValidityDaysOptional } from "@/components/pricing/PricesProvider";
import { useScheduleConfigOptional } from "@/components/booking/ScheduleProvider";

type ModalKey = "cancelacion" | "terminos" | "privacidad" | null;

const LINK_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  color: "#86948a",
  textDecoration: "none",
  transition: "color 0.15s",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
  padding: 0,
  marginBottom: "14px",
};

/**
 * REFACTOR-R4-P2-03: pack validity + cancellation window. From the commerce context
 * when the page mounts CommerceProviders; otherwise fetched from `/api/policy` once
 * `needed` turns true (a modal that quotes them is open). `null` until known.
 */
function usePolicyNumbers(needed: boolean): PolicyNumbers | null {
  const days  = usePackValidityDaysOptional();
  const sched = useScheduleConfigOptional();
  const fromContext = days !== null && sched !== null;
  const [fetched, setFetched] = useState<PolicyNumbers | null>(null);
  // Set while a request is in flight or has answered, so reopening the modal
  // mid-request doesn't fire a second one. Cleared on failure: the next open retries.
  const requested = useRef(false);

  useEffect(() => {
    if (!needed || fromContext || requested.current) return;
    requested.current = true;
    fetch("/api/policy")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((numbers: PolicyNumbers) => setFetched(numbers))
      .catch(() => {
        requested.current = false;
      });
  }, [needed, fromContext]);

  if (days !== null && sched !== null) {
    return { packValidityDays: days, cancelHours: sched.cancelMinNoticeHours };
  }
  return fetched;
}

/** REFACTOR-R4-P2-03: stands in for the policy copy while `/api/policy` answers. */
function PolicySkeleton() {
  return (
    <div aria-busy="true" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[92, 100, 74, 86].map((width) => (
        <div
          key={width}
          aria-hidden="true"
          style={{
            height: 12,
            width: `${width}%`,
            borderRadius: 6,
            background: "rgba(255,255,255,0.08)",
          }}
        />
      ))}
    </div>
  );
}

export default function FooterModals() {
  const t      = useTranslations("footerModals");
  const locale = useLocale();
  const [open, setOpen] = useState<ModalKey>(null);
  const policy = usePolicyNumbers(open === "cancelacion" || open === "terminos");

  function close() {
    setOpen(null);
    document.body.style.overflow = "";
  }

  function openModal(key: ModalKey) {
    setOpen(key);
    document.body.style.overflow = "hidden";
  }

  const hoverGreen = (e: React.MouseEvent) =>
    ((e.currentTarget as HTMLElement).style.color = "#4edea3");
  const unhover = (e: React.MouseEvent) =>
    ((e.currentTarget as HTMLElement).style.color = "#86948a");

  return (
    <>
      {/* ── Links ── */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        <li>
          <button
            onClick={() => openModal("cancelacion")}
            style={LINK_STYLE}
            onMouseEnter={hoverGreen}
            onMouseLeave={unhover}
          >
            {t("cancellation")}
          </button>
        </li>
        <li>
          <Link
            href="/terminos"
            onClick={(e) => {
              e.preventDefault();
              openModal("terminos");
            }}
            style={LINK_STYLE}
            onMouseEnter={hoverGreen}
            onMouseLeave={unhover}
          >
            {t("terms")}
          </Link>
        </li>
        <li>
          <Link
            href="/privacidad"
            onClick={(e) => {
              e.preventDefault();
              openModal("privacidad");
            }}
            style={{ ...LINK_STYLE, marginBottom: 0 }}
            onMouseEnter={hoverGreen}
            onMouseLeave={unhover}
          >
            {t("privacy")}
          </Link>
        </li>
      </ul>

      {/* ── Modal overlay ── */}
      {open && (
        <div
          onClick={(e) => e.target === e.currentTarget && close()}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 560,
              maxHeight: "80vh",
              borderRadius: "16px",
              background: "rgba(53,52,55,0.9)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(32px)",
              WebkitBackdropFilter: "blur(32px)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                flexShrink: 0,
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-headline, Manrope), sans-serif",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#e5e1e4",
                  margin: 0,
                }}
              >
                {open === "cancelacion" && t("cancellation")}
                {open === "terminos" && t("terms")}
                {open === "privacidad" && t("privacy")}
              </h2>
              <button
                onClick={close}
                aria-label={t("close")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#86948a",
                  display: "flex",
                  padding: "4px",
                  borderRadius: "6px",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#e5e1e4")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#86948a")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div
              className="policy-body"
              style={{
                overflowY: "auto",
                padding: "24px",
                flex: 1,
              }}
            >
              {open === "cancelacion" && (policy
                ? <CancelacionContent locale={locale} packValidityDays={policy.packValidityDays} cancelHours={policy.cancelHours} />
                : <PolicySkeleton />)}
              {open === "terminos" && (policy
                ? <TerminosContent locale={locale} packValidityDays={policy.packValidityDays} cancelHours={policy.cancelHours} />
                : <PolicySkeleton />)}
              {open === "privacidad" && <PrivacidadContent locale={locale} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
