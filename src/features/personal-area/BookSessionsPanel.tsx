"use client";

/**
 * BookSessionsPanel — the sticky booking sidebar.
 *
 * Every row opens its booking screen in place (useBookingActions.ts) — it used to
 * `router.push("/mentoria?book=<key>")` and let Mentoría open it. The row keys ARE the
 * intents: `SESSION_KEYS`/`PACK_KEYS` double as the argument to `openBooking`. Live prices
 * from PricesProvider; styling in area-personal.css.
 */

import { useTranslations } from "next-intl";
import { usePrices, usePricesSyncing } from "@/components/pricing/PricesProvider";
import type { UserSession } from "@/domain/types";
import { useBookingActions } from "./useBookingActions";

interface BookSessionsPanelProps {
  hasActivePack: boolean;
  packSession:   UserSession | null;
}

// Icons are non-translatable; text comes from the dictionary.
const SESSION_KEYS = [
  { key: "free15min", icon: "chat_bubble" },
  { key: "session1h", icon: "timer"       },
  { key: "session2h", icon: "timelapse"   },
] as const;

const PACK_KEYS = [
  { key: "pack5",  icon: "package_2"   },
  { key: "pack10", icon: "inventory_2" },
] as const;

export default function BookSessionsPanel({ hasActivePack, packSession }: BookSessionsPanelProps) {
  const t = useTranslations("areaPersonal.bookPanel");
  const prices = usePrices();
  // PRICING-STUDENT-01: a signed-in student's own prices may still be in flight.
  // There is no skeleton treatment in this panel (and the skeletonPulse keyframe
  // lives in InteractiveShell, which /area-personal never mounts), so the price
  // is held invisible-but-space-reserving: no public-price flash, no layout shift.
  const pricesSyncing = usePricesSyncing();
  const { openBooking } = useBookingActions();

  return (
    <div className="pa-panel">
      <h3>{t("title")}</h3>
      <p className="pa-desc">{t("subtitle")}</p>

      {/* Pack credit shortcut — only when the student has credits to spend */}
      {hasActivePack && packSession && (
        <button type="button" className="pa-creditcta" onClick={() => openBooking("pack")}>
          <span className="pa-ic">
            <span className="material-symbols-outlined" aria-hidden="true">redeem</span>
          </span>
          <span className="pa-tx">
            <b>{t("usePackCredit")}</b>
            <small>{t("packCredits", { count: packSession.credits })}</small>
          </span>
          <span className="material-symbols-outlined pa-arr" aria-hidden="true">chevron_right</span>
        </button>
      )}

      <p className="pa-sechead">{t("singleSessionsLabel")}</p>
      <div className="pa-slist">
        {SESSION_KEYS.map(({ key, icon }) => (
          <SessionRow
            key={key}
            icon={icon}
            label={t(`sessions.${key}.label` as Parameters<typeof t>[0])}
            sub={t(`sessions.${key}.sub` as Parameters<typeof t>[0])}
            // free15min is free (kept in i18n); paid sessions read the live price.
            price={key === "free15min" ? t("sessions.free15min.price") : prices[key].price}
            isFree={key === "free15min"}
            loading={key !== "free15min" && pricesSyncing}
            onClick={() => openBooking(key)}
          />
        ))}
      </div>

      <p className="pa-sechead">{t("packsLabel")}</p>
      <div className="pa-slist">
        {PACK_KEYS.map(({ key, icon }) => {
          const p = prices[key];
          // Savings copy is computed from the live price; empty when no discount.
          const sub = p.savingsAmount && p.savingsPct !== null
            ? t("packs.sub", { amount: p.savingsAmount, pct: p.savingsPct })
            : "";
          return (
            <SessionRow
              key={key}
              icon={icon}
              label={t(`packs.${key}.label` as Parameters<typeof t>[0])}
              sub={sub}
              price={p.price}
              loading={pricesSyncing}
              subIsPriceDerived
              onClick={() => openBooking(key)}
            />
          );
        })}
      </div>
    </div>
  );
}

function SessionRow({
  icon, label, sub, price, isFree = false, loading = false, subIsPriceDerived = false, onClick,
}: {
  icon:    string;
  label:   string;
  sub:     string;
  price:   string;
  isFree?: boolean;
  /** PRICING-STUDENT-01: hold the price invisible while this student's own is resolving. */
  loading?: boolean;
  /** True when `sub` is computed from the price (the packs' savings copy), so it
   *  has to be held back with the price rather than flashing the public figure. */
  subIsPriceDerived?: boolean;
  onClick: () => void;
}) {
  const hidden = { visibility: "hidden" } as const;
  return (
    <button type="button" className="pa-srow" onClick={onClick}>
      <span className="pa-srow__ic">
        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
      </span>
      <span className="pa-srow__tx">
        <b>{label}</b>
        {sub && (
          <small style={loading && subIsPriceDerived ? hidden : undefined}>{sub}</small>
        )}
      </span>
      <span
        className={`pa-srow__price${isFree ? " pa-free" : ""}`}
        style={loading ? hidden : undefined}
      >
        {price}
      </span>
    </button>
  );
}
