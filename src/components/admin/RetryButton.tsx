/**
 * ADMIN-01: Client component to retry a failed booking.
 * POSTs to the existing /api/admin/failed-bookings endpoint (REL-03).
 *
 * DEAD-LETTER-RETRY-02: a retry that found the slot taken refunds the student instead of
 * booking — say so (amber) instead of the green «Procesado correctamente».
 */
"use client";

import { useState } from "react";

interface RetryButtonProps {
  stripeSessionId: string;
}

export function RetryButton({ stripeSessionId }: RetryButtonProps) {
  const [status, setStatus]   = useState<"idle" | "loading" | "ok" | "refunded" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function retry() {
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/failed-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stripeSessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data as { ok?: boolean }).ok) {
        if ((data as { outcome?: string }).outcome === "refunded") {
          setStatus("refunded");
          setMessage("Reembolsado al alumno: el hueco ya no estaba libre.");
        } else {
          setStatus("ok");
          setMessage("Procesado correctamente.");
        }
      } else {
        setStatus("error");
        setMessage((data as { error?: string }).error ?? "Error al reintentar.");
      }
    } catch {
      setStatus("error");
      setMessage("Error de red.");
    }
  }

  if (status === "ok") {
    return <span className="success-text">✓ {message}</span>;
  }
  if (status === "refunded") {
    return <span className="warning-text">↩ {message}</span>;
  }

  return (
    <div className="cell-stack" style={{ alignItems: "flex-end" }}>
      <button
        onClick={retry}
        disabled={status === "loading"}
        className={`btn-ghost-sm ${status === "loading" ? "is-loading" : ""}`}
      >
        {status === "loading" ? "Reintentando…" : "Reintentar"}
      </button>
      {status === "error" && message && (
        <span className="error-text" style={{ fontSize: 11 }}>
          {message}
        </span>
      )}
    </div>
  );
}
