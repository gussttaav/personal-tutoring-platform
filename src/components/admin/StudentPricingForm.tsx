/**
 * PRICING-STUDENT-01: admin form for ONE student's private prices.
 *
 * A blank field means "no override — this student pays the public price", and
 * clearing a field that had one DELETEs the override rather than freezing a copy
 * of today's public price. The public price is shown beside each input so blank
 * reads as a real value rather than as missing data.
 *
 * Mirrors PricingForm: diff-only submit, mandatory reason, POST then full reload.
 * Admin panel is Spanish.
 *
 * ADMIN-02: cells are marked for the phone layout (one card per product).
 */
"use client";

import { useState } from "react";
import type { PriceRecord, ProductKey } from "@/domain/types";
import { centsToInput, inputToCents, formatEuros } from "@/components/admin/price-input";

const PRODUCT_LABELS: Record<ProductKey, string> = {
  session1h: "Sesión 1 hora",
  session2h: "Sesión 2 horas",
  pack5:     "Pack 5 clases",
  pack10:    "Pack 10 clases",
};

const PRODUCT_ORDER: ProductKey[] = ["session1h", "session2h", "pack5", "pack10"];

export function StudentPricingForm({
  email,
  defaults,
  overrides,
}: {
  email:     string;
  /** The public prices, for the "por defecto" column. */
  defaults:  PriceRecord[];
  /** This student's existing overrides — sparse, 0–4 rows. */
  overrides: PriceRecord[];
}) {
  const defaultByKey  = new Map(defaults.map((p) => [p.productKey, p]));
  const overrideByKey = new Map(overrides.map((p) => [p.productKey, p]));

  const [amounts, setAmounts] = useState<Record<ProductKey, string>>(() => {
    const init = {} as Record<ProductKey, string>;
    for (const key of PRODUCT_ORDER) {
      const rec = overrideByKey.get(key);
      init[key] = rec ? centsToInput(rec.amountCents) : "";
    }
    return init;
  });

  const [reason, setReason]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function setAmount(key: ProductKey, value: string) {
    setAmounts((a) => ({ ...a, [key]: value }));
  }

  async function submit() {
    setError(null);
    if (!reason.trim()) {
      setError("La razón es obligatoria.");
      return;
    }

    // null = clear the override. Only rows whose value actually changed are sent,
    // so a save never writes a no-op row or a spurious audit entry.
    const updates: { productKey: ProductKey; amountCents: number | null }[] = [];

    for (const key of PRODUCT_ORDER) {
      const parsed = inputToCents(amounts[key]);

      if (Number.isNaN(parsed)) {
        setError(`Precio inválido para ${PRODUCT_LABELS[key]}.`);
        return;
      }
      if (parsed !== null && parsed <= 0) {
        setError(`El precio de ${PRODUCT_LABELS[key]} debe ser mayor que 0.`);
        return;
      }

      const current = overrideByKey.get(key)?.amountCents ?? null;
      if (parsed !== current) {
        updates.push({ productKey: key, amountCents: parsed });
      }
    }

    if (updates.length === 0) {
      setError("No hay cambios que guardar.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/students/${encodeURIComponent(email)}/pricing`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prices: updates, reason: reason.trim() }),
        },
      );
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Error al guardar los precios.");
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
        <span className="material-symbols-outlined">sell</span>
        <h3>Precios personalizados</h3>
        <span className="adjust-form-hint">Vacío = precio por defecto</span>
      </div>

      <table className="data-table pricing-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Precio para este alumno (€)</th>
            <th>Por defecto</th>
          </tr>
        </thead>
        <tbody>
          {PRODUCT_ORDER.map((key) => {
            const def = defaultByKey.get(key);
            return (
              <tr key={key}>
                <td className="c-main cell-strong">{PRODUCT_LABELS[key]}</td>
                <td data-label="Precio alumno (€)">
                  <input
                    className="pricing-input"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="—"
                    value={amounts[key]}
                    onChange={(e) => setAmount(key, e.target.value)}
                  />
                </td>
                <td className="pricing-na" data-label="Por defecto">
                  {def ? formatEuros(def.amountCents) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="adjust-form-row">
        <input
          className="adjust-reason"
          type="text"
          placeholder="Razón — ej: Beca parcial acordada en septiembre"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button className="btn-primary" onClick={submit} disabled={loading}>
          {loading ? "Guardando…" : "Guardar"}
        </button>
      </div>

      {error && <p className="adjust-form-error">{error}</p>}
    </div>
  );
}
