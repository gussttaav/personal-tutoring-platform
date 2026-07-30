"use client";

/**
 * PackBanner — full-width active-pack summary at the top of /area-personal.
 *
 * Replaces PackStatusCard, which sat inside the left column. Same data, but the
 * redesign promotes it above the grid and adds the pack's validity date, which
 * /api/credits now returns (it was always resolved by the repository and dropped
 * at the route).
 */

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { UserSession } from "@/domain/types";
import { formatDate } from "@/lib/formatting";

export default function PackBanner({ packSession }: { packSession: UserSession }) {
  const t      = useTranslations("areaPersonal.packStatus");
  const locale = useLocale() as "es" | "en";
  const router = useRouter();

  const { credits, packSize, expiresAt } = packSession;

  // `credits` is the sum across every active pack, while `packSize` describes only
  // the soonest-expiring one (SupabaseCreditsRepository.getCredits). With two packs
  // open, credits can exceed that size — so clamp instead of trusting the subtraction.
  const total    = packSize ?? 5;
  const used     = Math.max(0, total - credits);
  const progress = Math.min(100, Math.max(0, (credits / total) * 100));

  const packLabel = packSize === 10 ? t("intensivePack") : t("essentialPack");

  const subtitle = [
    t("usedCredits", { count: used }),
    expiresAt
      ? t("validUntil", {
          date: formatDate(expiresAt, locale, { day: "numeric", month: "short", year: "numeric" }),
        })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="pa-packbanner" aria-label={packLabel}>
      <div className="pa-pb__top">
        <div className="pa-pb__icon">
          <span className="material-symbols-outlined" aria-hidden="true">inventory_2</span>
        </div>
        <div>
          <div className="pa-pb__title">
            {packLabel}
            <span className="pa-badge pa-badge--active">
              <span className="material-symbols-outlined" aria-hidden="true">bolt</span>
              {t("active")}
            </span>
          </div>
          <div className="pa-pb__sub">{subtitle}</div>
        </div>

        <div className="pa-pb__meter">
          <div className="pa-k">{t("remainingLabel")}</div>
          <div className="pa-pb__count">
            {credits}
            <small>/{total}</small>
          </div>
          <div
            className="pa-pb__track"
            role="progressbar"
            aria-valuenow={credits}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={t("remainingLabel")}
          >
            <div className="pa-pb__fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="pa-pb__bottom">
        <p>
          {t("ctaPrefix")} <b>{t("ctaAvailable", { count: credits })}</b> {t("ctaSuffix")}
        </p>
        <button
          type="button"
          className="pa-btn pa-btn--primary"
          onClick={() => router.push("/?book=pack")}
        >
          <span className="material-symbols-outlined" aria-hidden="true">calendar_add_on</span>
          {t("bookButton")}
        </button>
      </div>
    </section>
  );
}
