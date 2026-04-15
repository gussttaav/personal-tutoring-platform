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
 * Usage:
 *   <PaymentForm
 *     clientSecret="pi_xxx_secret_yyy"
 *     onSuccess={(pi_id) => ...}
 *     onCancel={() => ...}
 *   />
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
import { primaryBtnStyle, secondaryBtnStyle } from "@/components/BookingModeView";

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

// ── Inner form (must be inside <Elements>) ────────────────────────────────────

interface CheckoutFormProps {
  onSuccess: (paymentIntentId: string) => void;
  onCancel:  () => void;
}

function CheckoutForm({ onSuccess, onCancel }: CheckoutFormProps) {
  const stripe   = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error,      setError]      = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError("");

    // Use paymentIntent.id from the response — not from component state —
    // so we always reference the exact PI that Stripe confirmed.
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message ?? "Error al procesar el pago.");
      setProcessing(false);
    } else if (paymentIntent) {
      onSuccess(paymentIntent.id);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PaymentElement />

      {error && <Alert variant="error">{error}</Alert>}

      <button
        type="submit"
        disabled={!stripe || !elements || processing}
        style={{
          ...primaryBtnStyle,
          opacity: (!stripe || !elements || processing) ? 0.7 : 1,
          cursor:  (!stripe || !elements || processing) ? "not-allowed" : "pointer",
        }}
      >
        {processing ? "Procesando..." : "Pagar"}
      </button>

      <button
        type="button"
        onClick={onCancel}
        disabled={processing}
        style={{
          ...secondaryBtnStyle,
          opacity: processing ? 0.5 : 1,
        }}
      >
        Cancelar
      </button>
    </form>
  );
}

// ── Outer wrapper ─────────────────────────────────────────────────────────────

interface PaymentFormProps {
  /** clientSecret from POST /api/stripe/checkout, fetched by the caller */
  clientSecret: string;
  onSuccess: (paymentIntentId: string) => void;
  onCancel:  () => void;
}

export default function PaymentForm({ clientSecret, onSuccess, onCancel }: PaymentFormProps) {
  const options: StripeElementsOptions = { clientSecret, appearance };

  return (
    <Elements stripe={getStripePromise()} options={options}>
      <CheckoutForm onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}
