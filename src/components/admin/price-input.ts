/**
 * Euro/cent conversion for the admin price inputs. Cents are the wire format
 * everywhere; euros exist only inside the <input>.
 *
 * PRICING-STUDENT-01: extracted from PricingForm.tsx so StudentPricingForm shares
 * one copy rather than duplicating the parsing rules (which decide what a blank
 * field means, and that is load-bearing for the per-student form).
 */

/** Cents → euros string for an input (e.g. 1650 → "16.50", 1600 → "16"). */
export function centsToInput(cents: number): string {
  return Number.isInteger(cents / 100) ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Euros input → integer cents, null when blank, NaN when unparseable. */
export function inputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const euros = parseFloat(trimmed.replace(",", "."));
  if (!Number.isFinite(euros)) return NaN;
  return Math.round(euros * 100);
}

/** Cents → "€16" / "€16,50" for read-only display. */
export function formatEuros(cents: number): string {
  const euros = cents / 100;
  return `€${Number.isInteger(euros) ? euros : euros.toFixed(2).replace(".", ",")}`;
}
