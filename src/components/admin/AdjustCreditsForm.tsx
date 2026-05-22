/**
 * ADMIN-01: Client component for adjusting a student's credit balance.
 * POSTs to /api/admin/students/[email] and reloads the page on success.
 */
"use client";

import { useState } from "react";

interface AdjustCreditsFormProps {
  email: string;
}

export function AdjustCreditsForm({ email }: AdjustCreditsFormProps) {
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason.trim()) {
      setError("La razón es obligatoria.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(email)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adjust_credits", amount, reason: reason.trim() }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Error al ajustar créditos.");
      }
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="adjust-form">
      <div className="adjust-form-head">
        <span className="material-symbols-outlined">tune</span>
        <h3>Ajustar créditos</h3>
        <span className="adjust-form-hint">Se registra en el historial</span>
      </div>
      <div className="adjust-form-row">
        <div className="adjust-stepper">
          <button type="button" onClick={() => setAmount((a) => a - 1)} aria-label="Restar">
            −
          </button>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
          />
          <button type="button" onClick={() => setAmount((a) => a + 1)} aria-label="Sumar">
            +
          </button>
        </div>
        <input
          className="adjust-reason"
          type="text"
          placeholder="Razón — ej: Corrección manual por error de cobro"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button className="btn-primary" onClick={submit} disabled={loading}>
          {loading ? "Guardando…" : "Aplicar"}
        </button>
      </div>
      <p className="adjust-form-foot">
        Acción: <code>POST /api/admin/students/{email}</code> ·{" "}
        <code>{`{ action: "adjust_credits", amount: ${amount}, reason }`}</code>
      </p>
      {error && <p className="adjust-form-error">{error}</p>}
    </div>
  );
}
