/**
 * constants/index.ts — Emerald Nocturne design tokens
 *
 * Mapping: old COLORS object → new Emerald Nocturne palette.
 * All existing component imports (BookingModeView, PackModal, etc.) continue to
 * work without modification.
 *
 * Pack config and other non-colour constants are unchanged.
 */

export const COLORS = {
  /* Backgrounds */
  background:    "#131315",
  surface:       "#1c1b1d",
  surface2:      "#201f22",

  /* Brand / Primary */
  brand:         "#4edea3",
  brandHover:    "#3bcf94",
  brandMuted:    "rgba(78, 222, 163, 0.12)",
  brandBorder:   "rgba(78, 222, 163, 0.25)",

  /* Text */
  textPrimary:   "#e5e1e4",
  textSecondary: "#bbcabf",
  textMuted:     "#86948a",

  /* Borders */
  border:        "rgba(255, 255, 255, 0.05)",
  borderVariant: "#3c4a42",

  /* Status */
  error:         "#ffb4ab",
  errorBg:       "rgba(255, 180, 171, 0.12)",
  warning:       "#fbbf24",
  warningBg:     "rgba(251, 191, 36, 0.12)",
  warningBorder: "rgba(251, 191, 36, 0.25)",
  errorBorder:   "rgba(255, 180, 171, 0.25)",

  /* Success (shared with brand in dark-emerald UI) */
  successBg:     "rgba(78, 222, 163, 0.1)",
  successBorder: "rgba(78, 222, 163, 0.25)",
} as const;

/** Available pack sizes (hours) */
export const PACK_SIZES = [5, 10] as const;

// Static, non-price pack metadata. Prices/savings/hourly-rate now live in the
// `pricing` table and are surfaced via PricesProvider (see src/lib/pricing-display.ts).
export const PACK_CONFIG = {
  5: {
    hours:       5,
    label:       "Pack Esencial",
  },
  10: {
    hours:       10,
    label:       "Pack Intensivo",
    recommended: true,
  },
} as const;

/** Pack validity period in months */
export const PACK_VALIDITY_MONTHS = 6;

// Google Business review link, surfaced in the post-class review flow.
export const GOOGLE_REVIEW_URL = "https://g.page/r/CeUEcIsZXTyiEBM/review";
