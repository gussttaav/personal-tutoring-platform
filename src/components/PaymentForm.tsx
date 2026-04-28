"use client";

/**
 * PaymentForm — embedded Stripe PaymentElement
 *
 * Purely presentational: accepts an already-fetched clientSecret and
 * renders the Stripe Elements form. The caller is responsible for
 * fetching the clientSecret (via POST /api/stripe/checkout) in a
 * user-interaction handler — NOT in a useEffect — so React Strict
 * Mode's double-effect invocation never creates orphaned PaymentIntents.
 *
 * Variants:
 *   "card"   (default) — self-contained card with header, optional appointment
 *            reminder pill, method header, form, and trust strip. Used when
 *            rendered on a full booking page (SingleSessionBooking paying phase).
 *   "inline" — form content only, no outer card. Used inside PackModal which
 *            already provides its own card container.
 */

import { useState } from "react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { getStripePromise } from "@/lib/stripe-client";
import { Alert } from "@/components/ui";

// ── Appearance ────────────────────────────────────────────────────────────────

const appearance: StripeElementsOptions["appearance"] = {
  theme: "night",
  variables: {
    colorPrimary:       "#4edea3",
    colorBackground:    "#1c1b1d",
    colorText:          "#e5e1e4",
    colorTextSecondary: "#bbcabf",
    colorDanger:        "#f87171",
    borderRadius:       "8px",
    fontFamily:         "inherit",
  },
  rules: {
    ".Input": {
      backgroundColor: "#0e0e10",
      border: "1px solid rgba(255,255,255,0.08)",
    },
    ".Input:focus": {
      border: "1px solid rgba(78,222,163,0.4)",
      boxShadow: "0 0 0 3px rgba(78,222,163,0.08)",
    },
    ".Label": {
      color: "#bbcabf",
    },
  },
};

// ── Trust strip items ─────────────────────────────────────────────────────────

const trustItems = [
  {
    label: "Transacción segura",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4edea3" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
  },
  {
    label: "Protegido por Stripe",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4edea3" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    label: "Cancelación 24h",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4edea3" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
];

// ── Inner form (must be inside <Elements>) ────────────────────────────────────

interface CheckoutFormProps {
  studentName:       string;
  studentEmail:      string;
  appointmentLabel?: string;
  priceLabel?:       string;
  variant:           "card" | "inline";
  onSuccess: (paymentIntentId: string) => void;
  onCancel:  () => void;
}

function CheckoutForm({
  studentName,
  studentEmail,
  appointmentLabel,
  priceLabel,
  variant,
  onSuccess,
  onCancel,
}: CheckoutFormProps) {
  const stripe   = useStripe();
  const elements = useElements();
  const [ready,      setReady]      = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error,      setError]      = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError("");
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        payment_method_data: {
          billing_details: { name: studentName, email: studentEmail, phone: "" },
        },
      },
    });
    if (stripeError) {
      setError(stripeError.message ?? "Error al procesar el pago.");
      setProcessing(false);
    } else if (paymentIntent) {
      onSuccess(paymentIntent.id);
    }
  }

  // ── Shared form body ────────────────────────────────────────────────────────

  const formBody = (
    <>
      {/* Stripe form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <PaymentElement
          onReady={() => setReady(true)}
          options={{
            wallets: { link: "never" },
            fields: {
              billingDetails: { email: "never", phone: "never", name: "never" },
            },
          }}
        />

        {error && <Alert variant="error">{error}</Alert>}

        {!ready ? (
          <p style={{ textAlign: "center", color: "#bbcabf", fontSize: 14 }}>
            Cargando formulario de pago...
          </p>
        ) : (
          <>
            {/* Pay button */}
            <button
              type="submit"
              disabled={processing}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: 14,
                background: "linear-gradient(105deg, #4edea3, #10b981)",
                border: "none",
                color: "#003824",
                fontFamily: "var(--font-headline, Manrope), sans-serif",
                fontWeight: 800,
                fontSize: 16,
                cursor: processing ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                letterSpacing: "-0.2px",
                transition: "filter 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease",
                boxShadow: "0 4px 12px rgba(78,222,163,0.2)",
                opacity: processing ? 0.85 : 1,
              }}
            >
              {processing ? (
                <>
                  <span
                    className="animate-spin"
                    style={{
                      width: 18, height: 18, display: "inline-block",
                      borderRadius: "50%",
                      border: "2px solid rgba(0,56,36,0.25)",
                      borderTopColor: "#003824",
                    }}
                  />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#003824" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span>{priceLabel ? `Pagar ${priceLabel}` : "Pagar"}</span>
                </>
              )}
            </button>

            {/* Cancel button */}
            <button
              type="button"
              onClick={onCancel}
              disabled={processing}
              style={{
                width: "100%",
                padding: 13,
                borderRadius: 12,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#86948a",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 500,
                cursor: processing ? "not-allowed" : "pointer",
                opacity: processing ? 0.5 : 1,
                transition: "background 0.2s, border-color 0.2s, color 0.2s",
              }}
              onMouseEnter={(e) => {
                if (processing) return;
                const el = e.currentTarget;
                el.style.background = "rgba(255,255,255,0.04)";
                el.style.borderColor = "rgba(255,255,255,0.15)";
                el.style.color = "#bbcabf";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.background = "transparent";
                el.style.borderColor = "rgba(255,255,255,0.08)";
                el.style.color = "#86948a";
              }}
            >
              Cancelar
            </button>
          </>
        )}
      </form>

      {/* Trust strip */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 20, marginTop: 28, paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.05)",
          flexWrap: "wrap",
        }}
      >
        {trustItems.map(({ label, icon }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#86948a" }}>
            {icon}
            <span>{label}</span>
          </div>
        ))}
      </div>
    </>
  );

  // ── Inline variant (used inside PackModal) ──────────────────────────────────
  if (variant === "inline") {
    return <div>{formBody}</div>;
  }

  // ── Card variant (used on the full booking page) ────────────────────────────
  return (
    <div
      style={{
        background: "#1c1b1d",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
        boxShadow: "0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      {/* Card header */}
      <div
        className="px-4 sm:px-6 py-4"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "#111113",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 34, height: 34, flexShrink: 0, borderRadius: 10,
            background: "rgba(78,222,163,0.12)",
            border: "1px solid rgba(78,222,163,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4edea3" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <span
          style={{
            fontSize: 11, fontWeight: 700,
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: "#4edea3",
          }}
        >
          Pago seguro · cifrado SSL
        </span>
      </div>

      {/* Card body */}
      <div className="px-4 sm:px-6 pt-6 sm:pt-7 pb-7 sm:pb-8">

        {/* Appointment reminder */}
        {appointmentLabel && (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 18px",
              background: "rgba(78,222,163,0.05)",
              border: "1px solid rgba(78,222,163,0.13)",
              borderRadius: 14,
              marginBottom: 28,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4edea3" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }} aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#bbcabf" }}>
              {appointmentLabel}
            </span>
          </div>
        )}

        {formBody}
      </div>
    </div>
  );
}

// ── Outer wrapper ─────────────────────────────────────────────────────────────

interface PaymentFormProps {
  clientSecret:      string;
  studentName:       string;
  studentEmail:      string;
  appointmentLabel?: string;
  priceLabel?:       string;
  variant?:          "card" | "inline";
  onSuccess: (paymentIntentId: string) => void;
  onCancel:  () => void;
}

export default function PaymentForm({
  clientSecret,
  studentName,
  studentEmail,
  appointmentLabel,
  priceLabel,
  variant = "card",
  onSuccess,
  onCancel,
}: PaymentFormProps) {
  const options: StripeElementsOptions = { clientSecret, appearance };

  return (
    <Elements stripe={getStripePromise()} options={options}>
      <CheckoutForm
        studentName={studentName}
        studentEmail={studentEmail}
        appointmentLabel={appointmentLabel}
        priceLabel={priceLabel}
        variant={variant}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}
