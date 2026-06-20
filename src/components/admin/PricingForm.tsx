/**
 * Admin form to edit the four product prices. POSTs changed rows to
 * /api/admin/pricing and reloads on success. Admin panel is Spanish.
 *
 * The pack "original" strikethrough price is NOT an input — it's derived as the
 * 1h session price × the pack's hours, shown read-only so the admin sees it
 * update live as they edit the 1h price.
 */
"use client";

import { useState } from "react";
import type { PriceRecord, ProductKey } from "@/domain/types";

const PRODUCT_LABELS: Record<ProductKey, string> = {
  session1h: "Sesión 1 hora",
  session2h: "Sesión 2 horas",
  pack5:     "Pack 5 clases",
  pack10:    "Pack 10 clases",
};

// Pack hours, used to derive the original (strikethrough) price.
const PACK_HOURS: Partial<Record<ProductKey, number>> = { pack5: 5, pack10: 10 };

const PRODUCT_ORDER: ProductKey[] = ["session1h", "session2h", "pack5", "pack10"];

/** Cents → euros string for an input (e.g. 1650 → "16.50", 1600 → "16"). */
function centsToInput(cents: number): string {
  return Number.isInteger(cents / 100) ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Euros input → integer cents, or null when blank/invalid. */
function inputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const euros = parseFloat(trimmed.replace(",", "."));
  if (!Number.isFinite(euros)) return NaN;
  return Math.round(euros * 100);
}

/** Cents → "€16" / "€16,50" for read-only display. */
function formatEuros(cents: number): string {
  const euros = cents / 100;
  return `€${Number.isInteger(euros) ? euros : euros.toFixed(2).replace(".", ",")}`;
}

export function PricingForm({ prices }: { prices: PriceRecord[] }) {
  const byKey = new Map(prices.map((p) => [p.productKey, p]));

  const [amounts, setAmounts] = useState<Record<ProductKey, string>>(() => {
    const init = {} as Record<ProductKey, string>;
    for (const key of PRODUCT_ORDER) {
      const rec = byKey.get(key);
      init[key] = rec ? centsToInput(rec.amountCents) : "";
    }
    return init;
  });

  const [reason, setReason]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Live-derived pack original = current 1h price × hours (cents), or null.
  const session1hCents = inputToCents(amounts.session1h);
  function derivedOriginalCents(key: ProductKey): number | null {
    const hours = PACK_HOURS[key];
    if (!hours || session1hCents === null || Number.isNaN(session1hCents)) return null;
    return session1hCents * hours;
  }

  function setAmount(key: ProductKey, value: string) {
    setAmounts((a) => ({ ...a, [key]: value }));
  }

  async function submit() {
    setError(null);
    if (!reason.trim()) {
      setError("La razón es obligatoria.");
      return;
    }

    const updates: { productKey: ProductKey; amountCents: number; reason: string }[] = [];

    for (const key of PRODUCT_ORDER) {
      const rec = byKey.get(key);
      if (!rec) continue;
      const amountCents = inputToCents(amounts[key]);

      if (amountCents === null || Number.isNaN(amountCents) || amountCents <= 0) {
        setError(`Precio inválido para ${PRODUCT_LABELS[key]}.`);
        return;
      }
      if (amountCents !== rec.amountCents) {
        updates.push({ productKey: key, amountCents, reason: reason.trim() });
      }
    }

    if (updates.length === 0) {
      setError("No hay cambios que guardar.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Error al guardar precios.");
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
        <h3>Precios</h3>
        <span className="adjust-form-hint">Se registra en el historial</span>
      </div>

      <table className="data-table pricing-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Precio (€)</th>
            <th>Precio original (auto)</th>
          </tr>
        </thead>
        <tbody>
          {PRODUCT_ORDER.map((key) => {
            const originalCents = derivedOriginalCents(key);
            return (
              <tr key={key}>
                <td>{PRODUCT_LABELS[key]}</td>
                <td>
                  <input
                    className="pricing-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amounts[key]}
                    onChange={(e) => setAmount(key, e.target.value)}
                  />
                </td>
                <td className="pricing-na">
                  {originalCents !== null ? formatEuros(originalCents) : "—"}
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
          placeholder="Razón — ej: Subida de tarifas 2026"
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
