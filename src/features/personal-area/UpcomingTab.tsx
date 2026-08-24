"use client";

/**
 * UpcomingTab — every upcoming class as an agenda row, each independently
 * joinable / reschedulable / cancellable.
 *
 * This is the functional half of the redesign, not a restyle. Before it, the
 * retired weekly calendar's context menu was the only way to act on a booking
 * that was not the soonest one: a student with three sessions booked could not
 * touch the second or third from this page.
 */

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import CancelSessionFlow from "./CancelSessionFlow";
import { dateTile, sessionTypeKey, timeRange, weekdayName } from "./session-display";
import type { UserBooking } from "./types";

interface UpcomingTabProps {
  bookings:    UserBooking[];
  onCancelled: () => void;
}

export default function UpcomingTab({ bookings, onCancelled }: UpcomingTabProps) {
  const t = useTranslations("areaPersonal.upcoming");
  const router = useRouter();

  if (bookings.length === 0) {
    return (
      <div className="pa-empty">
        <div className="pa-ic">
          <span className="material-symbols-outlined" aria-hidden="true">calendar_month</span>
        </div>
        <h3>{t("emptyTitle")}</h3>
        <p>{t("emptyBody")}</p>
        <button
          type="button"
          className="pa-btn pa-btn--primary pa-btn--lg"
          onClick={() => router.push("/?book=free15min")}
        >
          <span className="material-symbols-outlined" aria-hidden="true">calendar_add_on</span>
          {t("emptyCta")}
        </button>
      </div>
    );
  }

  return (
    <ul className="pa-agenda">
      {bookings.map((b) => (
        <li key={b.eventId || b.token}>
          <UpcomingItem booking={b} onCancelled={onCancelled} />
        </li>
      ))}
    </ul>
  );
}

function UpcomingItem({ booking, onCancelled }: { booking: UserBooking; onCancelled: () => void }) {
  const t        = useTranslations("areaPersonal.upcoming");
  const tSession = useTranslations("areaPersonal.nextSession");
  const tCommon  = useTranslations("common");
  const locale   = useLocale() as "es" | "en";
  const router   = useRouter();

  const { day, month } = dateTile(booking.startsAt, locale);
  const typeKey = sessionTypeKey(booking.sessionType);
  const label   = tSession(`sessionLabels.${typeKey}` as Parameters<typeof tSession>[0]);

  // free15min shows the "free" chip; a pack class shows which pack it draws from.
  const chip =
    typeKey === "free15min"
      ? { className: "pa-chip pa-chip--free", text: t("chipFree") }
      : typeKey === "pack"
        ? { className: "pa-chip pa-chip--pack", text: `${t("chipPack")} ${booking.packSize ?? ""}h`.trim() }
        : null;

  return (
    <div className="pa-aitem">
      <div className="pa-aitem__date">
        <span className="pa-m">{month}</span>
        <span className="pa-d">{day}</span>
      </div>

      <div className="pa-aitem__main">
        <h4>{label}</h4>
        <div className="pa-aitem__row">
          <span>
            <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
            {weekdayName(booking.startsAt, locale, "short")} · {timeRange(booking.startsAt, booking.endsAt, locale)}
          </span>
          <span>
            <span className="material-symbols-outlined" aria-hidden="true">videocam</span>
            {t("zoomShort")}
          </span>
          {chip && <span className={chip.className}>{chip.text}</span>}
        </div>
      </div>

      <CancelSessionFlow
        token={booking.token}
        onCancelled={onCancelled}
        renderTrigger={(openConfirm) => (
          <div className="pa-aitem__cta">
            <button
              type="button"
              className="pa-iconbtn"
              title={t("join")}
              aria-label={t("join")}
              onClick={() => { window.location.href = `/sesion/${booking.joinToken}`; }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">play_circle</span>
            </button>
            <button
              type="button"
              className="pa-iconbtn"
              title={t("reschedule")}
              aria-label={t("reschedule")}
              onClick={() => router.push(`/?reschedule=${booking.sessionType}&token=${booking.token}`)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">event_repeat</span>
            </button>
            <button
              type="button"
              className="pa-iconbtn pa-iconbtn--danger"
              title={tCommon("cancel")}
              aria-label={tCommon("cancel")}
              onClick={openConfirm}
            >
              <span className="material-symbols-outlined" aria-hidden="true">cancel</span>
            </button>
          </div>
        )}
      />
    </div>
  );
}
