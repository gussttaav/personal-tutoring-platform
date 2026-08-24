"use client";

/**
 * BookSessionsPanel — the sticky booking sidebar.
 *
 * Logic is unchanged by the redesign (same deep links into the booking flow, same
 * live prices from PricesProvider); only the styling moved from inline objects to
 * area-personal.css.
 */

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePrices } from "@/components/pricing/PricesProvider";
import type { UserSession } from "@/domain/types";

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
  const router = useRouter();
  const prices = usePrices();

  return (
    <div className="pa-panel">
      <h3>{t("title")}</h3>
      <p className="pa-desc">{t("subtitle")}</p>

      {/* Pack credit shortcut — only when the student has credits to spend */}
      {hasActivePack && packSession && (
        <button type="button" className="pa-creditcta" onClick={() => router.push("/?book=pack")}>
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
            onClick={() => router.push(`/?book=${key}`)}
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
              onClick={() => router.push(`/?book=${key}`)}
            />
          );
        })}
      </div>
    </div>
  );
}

function SessionRow({
  icon, label, sub, price, isFree = false, onClick,
}: {
  icon:    string;
  label:   string;
  sub:     string;
  price:   string;
  isFree?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="pa-srow" onClick={onClick}>
      <span className="pa-srow__ic">
        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
      </span>
      <span className="pa-srow__tx">
        <b>{label}</b>
        {sub && <small>{sub}</small>}
      </span>
      <span className={`pa-srow__price${isFree ? " pa-free" : ""}`}>{price}</span>
    </button>
  );
}
