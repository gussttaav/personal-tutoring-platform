/**
 * ADMIN-01: Client component to retry a failed booking.
 * POSTs to the existing /api/admin/failed-bookings endpoint (REL-03).
 */
"use client";

import { useState } from "react";

interface RetryButtonProps {
  stripeSessionId: string;
}

export function RetryButton({ stripeSessionId }: RetryButtonProps) {
  const [status, setStatus]   = useState<"idle" | "loading" | "ok" | "error">("idle");
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
        setStatus("ok");
        setMessage("Procesado correctamente.");
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
