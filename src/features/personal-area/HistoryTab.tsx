"use client";

/**
 * HistoryTab — past classes, grouped by month, with the three stat cards on top.
 *
 * First web consumer of GET /api/my-bookings/history. That endpoint was built for
 * the mobile app (BOOKING-HISTORY-01) and already carries everything shown here,
 * including each class's review — so the stats are derived client-side in
 * history-stats.ts rather than by a new aggregate route. The caller (usePersonalAreaData)
 * has already paged it, so the totals describe the whole history, not one page.
 */

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { BookingHistoryEntry } from "@/domain/types";
import {
  computeHistoryStats,
  durationMinutes,
  groupByMonth,
  paymentLabel,
} from "./history-stats";
import PastClassModal from "./PastClassModal";
import { sessionTypeKey, timeRange, viewerTimeZone } from "./session-display";
import { StarsReadOnly } from "./StarRating";
import type { HistoryState } from "./types";

/** Stable identity for the loading/error cases so the memos below stay cached. */
const EMPTY: BookingHistoryEntry[] = [];

interface HistoryTabProps {
  state:       HistoryState;
  truncated:   boolean;
  onLoadMore:  () => void;
  onRetry:     () => void;
  onReviewed:  (id: string, review: { rating: number; comment: string | null }) => void;
}

export default function HistoryTab({
  state,
  truncated,
  onLoadMore,
  onRetry,
  onReviewed,
}: HistoryTabProps) {
  const t       = useTranslations("areaPersonal.history");
  const tMain   = useTranslations("areaPersonal.main");
  const tCommon = useTranslations("common");
  const locale  = useLocale() as "es" | "en";

  const [openId, setOpenId] = useState<string | null>(null);

  // Derived inside the memos, not above them: a fresh `[]` on every render would
  // defeat both caches (react-hooks/exhaustive-deps flags exactly this).
  const stats  = useMemo(
    () => computeHistoryStats(Array.isArray(state) ? state : EMPTY),
    [state],
  );
  const months = useMemo(
    () => groupByMonth(Array.isArray(state) ? state : EMPTY, locale, viewerTimeZone()),
    [state, locale],
  );

  const entries = Array.isArray(state) ? state : EMPTY;

  if (state === "loading") {
    return (
      <div className="pa-skeleton">
        <div className="pa-dots" role="status" aria-live="polite">
          <span /><span /><span />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="pa-error" role="alert">
        <p>{t("loadError")}</p>
        <button type="button" className="pa-btn pa-btn--ghost" onClick={onRetry}>
          {tMain("retry")}
        </button>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="pa-empty">
        <div className="pa-ic">
          <span className="material-symbols-outlined" aria-hidden="true">history</span>
        </div>
        <h3>{t("emptyTitle")}</h3>
        <p>{t("emptyBody")}</p>
      </div>
    );
  }

  const openEntry = entries.find((e) => e.id === openId) ?? null;

  return (
    <>
      <div className="pa-hstats">
        <div className="pa-hstat">
          <div className="pa-n">{stats.completed}</div>
          <div className="pa-l">{t("statCompleted")}</div>
        </div>
        <div className="pa-hstat">
          <div className="pa-n pa-g">
            {stats.averageRating !== null
              ? `${stats.averageRating.toFixed(1)} ★`
              : t("noRatings")}
          </div>
          <div className="pa-l">{t("statAvgRating")}</div>
        </div>
        <div className="pa-hstat">
          <div className="pa-n">
            {t("hoursValue", { hours: Math.round(stats.totalMinutes / 60) })}
          </div>
          <div className="pa-l">{t("statHours")}</div>
        </div>
      </div>

      {months.map((month) => (
        <section key={month.key}>
          <h3 className="pa-hmonth">{month.label}</h3>
          <div className="pa-hlist">
            {month.entries.map((entry) => (
              <HistoryItem
                key={entry.id}
                entry={entry}
                locale={locale}
                onOpen={() => setOpenId(entry.id)}
              />
            ))}
          </div>
        </section>
      ))}

      {truncated ? (
        <div className="pa-hmore">
          <button type="button" className="pa-btn pa-btn--ghost" onClick={onLoadMore}>
            {tCommon("loadMore")}
          </button>
        </div>
      ) : (
        <p className="pa-hend">{t("end")}</p>
      )}

      {openEntry && (
        <PastClassModal
          entry={openEntry}
          onClose={() => setOpenId(null)}
          onReviewed={onReviewed}
        />
      )}
    </>
  );
}

// ─── One past class ───────────────────────────────────────────────────────────

function HistoryItem({
  entry,
  locale,
  onOpen,
}: {
  entry:  BookingHistoryEntry;
  locale: "es" | "en";
  onOpen: () => void;
}) {
  const t        = useTranslations("areaPersonal.history");
  const tSession = useTranslations("areaPersonal.nextSession");

  const isCancelled = entry.status === "cancelled";
  const label = tSession(`sessionLabels.${sessionTypeKey(entry.sessionType)}` as Parameters<typeof tSession>[0]);

  const tz  = viewerTimeZone();
  const tag = locale === "en" ? "en-GB" : "es-ES";
  const day = new Intl.DateTimeFormat(tag, { day: "numeric", ...(tz ? { timeZone: tz } : {}) })
    .format(new Date(entry.startsAt));
  const weekday = new Intl.DateTimeFormat(tag, { weekday: "short", ...(tz ? { timeZone: tz } : {}) })
    .format(new Date(entry.startsAt))
    .replace(".", "");

  const pay     = paymentLabel(entry, locale);
  const payText = pay.key === "payCard" ? t("payCard", { amount: pay.amount }) : t(pay.key);
  const minutes = durationMinutes(entry);

  return (
    <button
      type="button"
      className={`pa-hitem${isCancelled ? " pa-hitem--cancel" : ""}`}
      onClick={onOpen}
    >
      <span className="pa-hitem__d">
        <span className="pa-d">{day}</span>
        <span className="pa-m">{weekday}</span>
      </span>

      <span className="pa-hitem__m">
        <span className="pa-t">{label}</span>
        <span className="pa-s">
          <span>
            {timeRange(entry.startsAt, entry.endsAt, locale)}
            {minutes > 0 && ` · ${minutes} min`}
          </span>

          {isCancelled ? (
            <span className="pa-pill pa-pill--cancel">
              <span className="material-symbols-outlined" aria-hidden="true">cancel</span>
              {t("pillCancelled")}
            </span>
          ) : entry.review ? (
            <StarsReadOnly
              rating={entry.review.rating}
              label={`${entry.review.rating} / 5`}
            />
          ) : (
            <span className="pa-pill pa-pill--warn">
              <span className="material-symbols-outlined" aria-hidden="true">star</span>
              {t("pillReview")}
            </span>
          )}

          <span>· {payText}</span>
        </span>
      </span>

      <span className="material-symbols-outlined pa-hitem__chev" aria-hidden="true">
        chevron_right
      </span>
    </button>
  );
}
