"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner, Alert } from "@/components/ui";
import { PACK_CONFIG } from "@/constants";
import { api, ApiError } from "@/lib/api-client";
import PaymentForm from "@/components/PaymentForm";
import type { PackSize } from "@/domain/types";

interface PackModalProps {
  packSize: PackSize;
  /** Verified email from the Google session */
  userEmail: string;
  /** Verified name from the Google session */
  userName: string;
  onClose: () => void;
  /** Pre-fetched clientSecret from the parent click handler.
   *  When absent (OAuth round-trip) the modal self-fetches on mount. */
  initialClientSecret?: string;
}

export default function PackModal({
  packSize,
  onClose,
  initialClientSecret,
}: PackModalProps) {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(initialClientSecret ?? null);
  const [fetching,     setFetching]     = useState(!initialClientSecret);
  const [fetchError,   setFetchError]   = useState("");

  const pack = PACK_CONFIG[packSize];

  // Hide the chat FAB on mobile while the modal is open
  useEffect(() => {
    document.body.classList.add("pack-modal-open");
    return () => document.body.classList.remove("pack-modal-open");
  }, []);

  // Self-fetch the PaymentIntent when the parent didn't pre-fetch one.
  // This covers the OAuth round-trip case (packClientSecret is null after login).
  // AbortController ensures React Strict Mode's first mount (setup → cleanup → setup)
  // discards the first fetch's result; only the second sets state.
  useEffect(() => {
    if (initialClientSecret) return; // parent already provided it
    const controller = new AbortController();
    api.stripe.checkout({ type: "pack", packSize })
      .then(({ clientSecret: cs }) => {
        if (!controller.signal.aborted) {
          setClientSecret(cs);
          setFetching(false);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setFetchError(
            err instanceof ApiError ? err.message : "Error al iniciar el pago."
          );
          setFetching(false);
        }
      });
    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePaymentSuccess(paymentIntentId: string) {
    router.push(`/pago-exitoso?payment_intent_id=${paymentIntentId}`);
  }

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      style={{ backgroundColor: "rgba(0,0,0,0.80)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pack-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Inner wrapper — scrollable on mobile, centered on desktop */}
      <div
        className="flex min-h-full items-center justify-center px-2 pt-20 pb-4 sm:px-4 sm:pt-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {/* Modal panel */}
        <div
          className="w-full max-w-lg overflow-hidden"
          style={{
            background: "rgba(32, 31, 34, 0.6)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderRadius: "0.5rem",
            border: "1px solid rgba(255,255,255,0.05)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >
          <div className="p-5 sm:p-8 space-y-6 sm:space-y-8">

            {/* Title — always visible */}
            <div>
              <h1
                id="pack-modal-title"
                className="text-3xl font-extrabold tracking-tighter"
                style={{ fontFamily: "Manrope, sans-serif", color: "#e5e1e4" }}
              >
                Pack {packSize} clases
              </h1>
              <p className="mt-1 text-sm" style={{ color: "#bbcabf" }}>
                {pack.price} · Pago seguro con Stripe
              </p>
            </div>

            {/* Body — three states */}
            {fetching ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                <Spinner />
              </div>
            ) : fetchError ? (
              <>
                <Alert variant="error">{fetchError}</Alert>
                <button
                  onClick={onClose}
                  className="w-full h-12 bg-transparent font-semibold text-sm transition-colors"
                  style={{ color: "#bbcabf" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#e5e1e4")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#bbcabf")}
                >
                  Cerrar
                </button>
              </>
            ) : clientSecret ? (
              <PaymentForm
                clientSecret={clientSecret}
                onSuccess={handlePaymentSuccess}
                onCancel={onClose}
              />
            ) : null}

          </div>
        </div>
      </div>
    </div>
  );
}
