import type { PackSize } from "@/types";

// ─── Packs ────────────────────────────────────────────────────────────────────

export const PACK_CONFIG: Record<
  PackSize,
  {
    size: PackSize;
    price: string;
    priceValue: number;
    perClass: string;
    savings: string;
    badge: string;
    featured?: boolean;
  }
> = {
  5: {
    size: 5,
    price: "€75",
    priceValue: 75,
    perClass: "€15/clase",
    savings: "Ahorras €5 vs sesiones sueltas",
    badge: "⚡ Popular",
    featured: true,
  },
  10: {
    size: 10,
    price: "€140",
    priceValue: 140,
    perClass: "€14/clase",
    savings: "Ahorras €20 vs sesiones sueltas",
    badge: "Máximo ahorro",
    featured: false,
  },
};

export const PACK_SIZES = [5, 10] as const satisfies readonly PackSize[];

export const PACK_VALIDITY_MONTHS = 6;

// ─── Design tokens (kept in sync with globals.css) ───────────────────────────

export const COLORS = {
  brand: "#3ddc84",
  brandHover: "#34c274",
  brandMuted: "rgba(61,220,132,0.12)",
  brandBorder: "rgba(61,220,132,0.2)",
  surface: "#141618",
  background: "#0d0f10",
  border: "rgba(255,255,255,0.07)",
  textPrimary: "#e8e9ea",
  textSecondary: "#7a7f84",
  textMuted: "#4a4f54",
  textBody: "#c9d1de",
  error: "#f87171",
  errorBg: "rgba(248,113,113,0.08)",
  errorBorder: "rgba(248,113,113,0.27)",
  warning: "#fbbf24",
  warningBg: "rgba(251,191,36,0.08)",
  warningBorder: "rgba(251,191,36,0.2)",
  successBg: "rgba(13,31,20,0.9)",
  successBorder: "rgba(61,220,132,0.27)",
} as const;

