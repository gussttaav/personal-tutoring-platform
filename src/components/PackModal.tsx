"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Alert } from "@/components/ui";
import { PACK_CONFIG } from "@/constants";
import { api, ApiError } from "@/lib/api-client";
import type { PackSize, StudentInfo } from "@/types";

interface PackModalProps {
  packSize: PackSize;
  /** Verified email from the Google session */
  userEmail: string;
  /** Verified name from the Google session */
  userName: string;
  onClose: () => void;
  /** Called when the user already has credits — skip checkout */
  onCreditsReady?: (student: StudentInfo) => void;
}

export default function PackModal({
  packSize,
  userEmail,
  userName,
  onClose,
  onCreditsReady,
}: PackModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { data: session } = useSession();
  const userImage = session?.user?.image ?? null;

  // Hide the chat FAB on mobile while the modal is open
  useEffect(() => {
    document.body.classList.add("pack-modal-open");
    return () => document.body.classList.remove("pack-modal-open");
  }, []);

  const pack = PACK_CONFIG[packSize];

  const handleBuy = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Check for existing credits first (user may have already purchased)
      const creditsData = await api.credits.get();
      if (creditsData.credits > 0) {
        onClose();
        onCreditsReady?.({
          email: userEmail,
          name: userName,
          credits: creditsData.credits,
        });
        return;
      }

      // No credits → go to Stripe (identity comes from server-side session)
      const checkoutData = await api.stripe.checkoutPack({ packSize });
      window.location.href = checkoutData.url;
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Error de conexión. Inténtalo de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }, [userEmail, userName, packSize, onClose, onCreditsReady]);

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
          {/* Title */}
          <div>
            <h1
              id="pack-modal-title"
              className="text-3xl font-extrabold tracking-tighter"
              style={{ fontFamily: "Manrope, sans-serif", color: "#e5e1e4" }}
            >
              Pack {packSize} clases
            </h1>
          </div>

          {/* Benefits bento-style rows */}
          <div className="space-y-3">
            <div
              className="p-4 rounded-lg flex items-center gap-4"
              style={{ backgroundColor: "#1c1b1d" }}
            >
              <span
                className="material-symbols-outlined text-2xl flex-shrink-0"
                style={{ color: "#4edea3" }}
                aria-hidden="true"
              >
                timer
              </span>
              <div>
                <p className="text-sm font-bold" style={{ color: "#e5e1e4" }}>
                  {packSize} sesiones de 1 hora
                </p>
                <p
                  className="text-[11px] uppercase tracking-wider"
                  style={{ color: "#bbcabf" }}
                >
                  Sesiones individuales
                </p>
              </div>
            </div>

            <div
              className="p-4 rounded-lg flex items-center gap-4"
              style={{ backgroundColor: "#1c1b1d" }}
            >
              <span
                className="material-symbols-outlined text-2xl flex-shrink-0"
                style={{ color: "#4edea3" }}
                aria-hidden="true"
              >
                calendar_month
              </span>
              <div>
                <p className="text-sm font-bold" style={{ color: "#e5e1e4" }}>
                  Reserva flexible — tú decides cuándo
                </p>
                <p
                  className="text-[11px] uppercase tracking-wider"
                  style={{ color: "#bbcabf" }}
                >
                  Gestión total desde el perfil
                </p>
              </div>
            </div>

            <div
              className="p-4 rounded-lg flex items-center gap-4"
              style={{ backgroundColor: "#1c1b1d" }}
            >
              <span
                className="material-symbols-outlined text-2xl flex-shrink-0"
                style={{ color: "#4edea3" }}
                aria-hidden="true"
              >
                event_available
              </span>
              <div>
                <p className="text-sm font-bold" style={{ color: "#e5e1e4" }}>
                  Vigencia de 180 días (6 meses)
                </p>
                <p
                  className="text-[11px] uppercase tracking-wider"
                  style={{ color: "#bbcabf" }}
                >
                  A partir de la fecha de compra
                </p>
              </div>
            </div>
          </div>

          {/* User verification */}
          <div
            className="p-4 rounded-lg flex items-center justify-between"
            style={{
              backgroundColor: "#0e0e10",
              border: "1px solid rgba(60,74,66,0.10)",
            }}
          >
            <div className="flex items-center gap-3">
              {userImage ? (
                <Image
                  src={userImage}
                  alt={userName}
                  width={32}
                  height={32}
                  className="rounded-full flex-shrink-0"
                  style={{ border: "1px solid rgba(78,222,163,0.2)", boxShadow: "0 0 0 2px rgba(78,222,163,0.1)" }}
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                  style={{ background: "rgba(78,222,163,0.12)", color: "#4edea3", border: "1px solid rgba(78,222,163,0.2)" }}
                >
                  {userName[0] ?? "U"}
                </div>
              )}
              <div>
                <p
                  className="text-[10px] uppercase tracking-wider font-semibold"
                  style={{ color: "#bbcabf" }}
                >
                  Identificado como
                </p>
                <p className="text-sm font-medium" style={{ color: "#e5e1e4" }}>
                  {userEmail}
                </p>
              </div>
            </div>
          </div>

          {/* Pricing summary */}
          <div className="space-y-4">
            <div
              className="pt-4 flex justify-between items-baseline"
              style={{ borderTop: "1px solid rgba(60,74,66,0.20)" }}
            >
              <div className="flex flex-col">
                <span
                  className="text-lg font-bold"
                  style={{ fontFamily: "Manrope, sans-serif", color: "#e5e1e4" }}
                >
                  Total
                </span>
                <span
                  className="text-xs font-medium mt-1"
                  style={{ color: "#4edea3" }}
                >
                  {pack.hourlyRate} / hora · vs €16 en sesión suelta
                </span>
              </div>

              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span
                    className="text-sm line-through"
                    style={{ color: "#bbcabf" }}
                  >
                    {pack.originalPrice}
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: "rgba(78,222,163,0.10)",
                      color: "#4edea3",
                    }}
                  >
                    {pack.savingsPill}
                  </span>
                </div>
                <div
                  className="text-3xl font-extrabold tracking-tighter mt-1"
                  style={{ fontFamily: "Manrope, sans-serif", color: "#4edea3" }}
                >
                  {pack.price}
                </div>
              </div>
            </div>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleBuy}
              disabled={loading}
              className="w-full h-14 font-extrabold text-lg rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed hover:brightness-110"
              style={{
                background: "linear-gradient(to right, #4edea3, #10b981)",
                color: "#002113",
                fontFamily: "Manrope, sans-serif",
                boxShadow: "0 8px 24px rgba(16,185,129,0.25)",
              }}
              aria-live="polite"
            >
              {loading ? (
                "Verificando..."
              ) : (
                <>
                  Comprar
                  <span
                    className="material-symbols-outlined text-xl"
                    aria-hidden="true"
                  >
                    arrow_forward
                  </span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              disabled={loading}
              className="w-full h-12 bg-transparent font-semibold text-sm transition-colors active:scale-[0.98] disabled:opacity-50"
              style={{ color: "#bbcabf" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "#e5e1e4")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "#bbcabf")
              }
            >
              Atrás
            </button>
          </div>
        </div>
      </div>
      </div>{/* end inner centering wrapper */}
    </div>
  );
}
