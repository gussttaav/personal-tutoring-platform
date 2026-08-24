"use client";

/**
 * NextClassHero — the soonest upcoming class, promoted to the top of the main
 * column. Replaces NextSessionCard (which lived in the sidebar).
 *
 * The overline renders `areaPersonal.nextSession.title` in its own <span>, with
 * the relative time as a sibling: e2e/booking-pack.spec.ts matches that string
 * with `exact: true`, so "Próxima clase" must not be concatenated with "· en 1 día".
 */

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { formatRelative } from "@/lib/formatting";
import CancelSessionFlow from "./CancelSessionFlow";
import { dateTile, sessionTypeKey, timeRange, weekdayName } from "./session-display";
import type { UserBooking } from "./types";

interface NextClassHeroProps {
  booking:     UserBooking;
  onCancelled: () => void;
}

export default function NextClassHero({ booking, onCancelled }: NextClassHeroProps) {
  const t       = useTranslations("areaPersonal.nextSession");
  const tUp     = useTranslations("areaPersonal.upcoming");
  const tCommon = useTranslations("common");
  const tModal  = useTranslations("areaPersonal.history.modal");
  const locale  = useLocale() as "es" | "en";
  const router  = useRouter();

  const { day, month } = dateTile(booking.startsAt, locale);
  const label = t(`sessionLabels.${sessionTypeKey(booking.sessionType)}` as Parameters<typeof t>[0]);

  return (
    <section className="pa-nextclass" aria-label={t("title")}>
      <div className="pa-ov">
        <span className="material-symbols-outlined" aria-hidden="true">notifications_active</span>
        {/* Own element — asserted with exact: true in e2e/booking-pack.spec.ts */}
        <span>{t("title")}</span>
        <span aria-hidden="true">·</span>
        <span>{formatRelative(booking.startsAt, locale)}</span>
      </div>

      <div className="pa-nc__body">
        <div className="pa-nc__date">
          <span className="pa-m">{month}</span>
          <span className="pa-d">{day}</span>
        </div>
        <div className="pa-nc__info">
          <h3>{label}</h3>
          <div className="pa-nc__meta">
            <span>
              <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
              {weekdayName(booking.startsAt, locale)} · {timeRange(booking.startsAt, booking.endsAt, locale)}
            </span>
            <span>
              <span className="material-symbols-outlined" aria-hidden="true">videocam</span>
              {t("zoomLabel")}
            </span>
            <span>
              <span className="material-symbols-outlined" aria-hidden="true">person</span>
              {tModal("withTutor")}
            </span>
          </div>
        </div>
      </div>

      <CancelSessionFlow
        token={booking.token}
        onCancelled={onCancelled}
        renderTrigger={(openConfirm) => (
          <div className="pa-nc__actions">
            <button
              type="button"
              className="pa-btn pa-btn--primary pa-btn--lg"
              onClick={() => { window.location.href = `/sesion/${booking.joinToken}`; }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">play_circle</span>
              {t("joinButton")}
            </button>
            <button
              type="button"
              className="pa-btn pa-btn--ghost"
              onClick={() => router.push(`/?reschedule=${booking.sessionType}&token=${booking.token}`)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">event_repeat</span>
              {tUp("reschedule")}
            </button>
            <button type="button" className="pa-btn pa-btn--danger" onClick={openConfirm}>
              <span className="material-symbols-outlined" aria-hidden="true">cancel</span>
              {tCommon("cancel")}
            </button>
          </div>
        )}
      />
    </section>
  );
}
