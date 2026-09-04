"use client";

/**
 * PersonalArea — root client component for /area-personal.
 *
 * Layout: pack banner (when the student has credits) → next-class hero → a tab
 * strip over three panes (Próximas · Historial · Mis cursos) → sticky booking
 * sidebar. Replaces the pre-redesign single-scroll page built around a weekly
 * time-grid calendar.
 *
 * Only the active pane is mounted. The mock toggled `display:none`, but mounting
 * one pane is cheaper and keeps Playwright's strict locators from matching text
 * inside a hidden pane.
 *
 * Data comes from usePersonalAreaData — three independent fetches, so a failure in
 * one tab cannot blank the page.
 */

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useUserSession } from "@/hooks/useUserSession";
import BookSessionsPanel from "./BookSessionsPanel";
import CoursesTab from "./CoursesTab";
import DangerZone from "./DangerZone";
import HistoryTab from "./HistoryTab";
import NextClassHero from "./NextClassHero";
import PackBanner from "./PackBanner";
import UpcomingTab from "./UpcomingTab";
import { usePersonalAreaData } from "./usePersonalAreaData";
import type { PersonalAreaTab, UserBooking } from "./types";

/** Stable identity so the "still loading" case does not hand down a fresh array. */
const EMPTY: UserBooking[] = [];

const TABS: { id: PersonalAreaTab; icon: string }[] = [
  { id: "upcoming", icon: "event_upcoming" },
  { id: "history",  icon: "history"        },
  { id: "courses",  icon: "school"         },
];

export default function PersonalArea() {
  const t      = useTranslations("areaPersonal.main");
  const locale = useLocale();
  const { packSession, isAuthLoading } = useUserSession();
  // ACCOUNT-DELETE-01: the deletion confirmation is typed against this address, and
  // packSession is null for a student who never bought a pack — so read the identity
  // from the session itself.
  const { data: session } = useSession();

  const {
    bookingsState,
    historyState,
    enrollmentsState,
    historyTruncated,
    refreshBookings,
    refreshHistory,
    loadMoreHistory,
    patchHistoryEntry,
  } = usePersonalAreaData(locale, isAuthLoading);

  const [active, setActive] = useState<PersonalAreaTab>("upcoming");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const hasActivePack = !!packSession && packSession.credits > 0;

  // Already narrowed to upcoming-only and sorted ascending by usePersonalAreaData.
  const upcoming    = Array.isArray(bookingsState) ? bookingsState : EMPTY;
  const nextSession = upcoming[0] ?? null;

  const counts: Record<PersonalAreaTab, number | null> = {
    upcoming: bookingsState === "loading" || bookingsState === "error" ? null : upcoming.length,
    history:  Array.isArray(historyState) ? historyState.length : null,
    courses:  Array.isArray(enrollmentsState) ? enrollmentsState.length : null,
  };

  /** Roving focus: ←/→ move between tabs, Home/End jump to the ends. */
  function onTabKeyDown(e: React.KeyboardEvent, index: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    let next = -1;

    if (delta !== 0)          next = (index + delta + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End")  next = TABS.length - 1;
    else return;

    e.preventDefault();
    setActive(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="pa">
      <div className="pa-head">
        <div>
          <h1>{t("title")}</h1>
          {packSession && (
            <p>
              {t("welcomeBack")} <b>{packSession.name.split(" ")[0]}</b>
            </p>
          )}
        </div>
      </div>

      {hasActivePack && <PackBanner packSession={packSession} />}

      <div className="pa-grid">
        <div className="pa-main">
          {nextSession && (
            <NextClassHero booking={nextSession} onCancelled={refreshBookings} />
          )}

          <div className="pa-tabs" role="tablist" aria-label={t("title")}>
            {TABS.map((tab, i) => {
              const selected = active === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => { tabRefs.current[i] = el; }}
                  type="button"
                  role="tab"
                  id={`pa-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`pa-panel-${tab.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(tab.id)}
                  onKeyDown={(e) => onTabKeyDown(e, i)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">{tab.icon}</span>
                  <span>{t(`tabs.${tab.id}` as Parameters<typeof t>[0])}</span>
                  {counts[tab.id] !== null && <span className="pa-cnt">{counts[tab.id]}</span>}
                </button>
              );
            })}
          </div>

          <div
            className="pa-pane"
            role="tabpanel"
            id={`pa-panel-${active}`}
            aria-labelledby={`pa-tab-${active}`}
            tabIndex={0}
          >
            {active === "upcoming" && (
              bookingsState === "loading" ? (
                <div className="pa-skeleton">
                  <div className="pa-dots" role="status" aria-live="polite">
                    <span /><span /><span />
                  </div>
                </div>
              ) : bookingsState === "error" ? (
                <div className="pa-error" role="alert">
                  <p>{t("loadError")}</p>
                  <button type="button" className="pa-btn pa-btn--ghost" onClick={refreshBookings}>
                    {t("retry")}
                  </button>
                </div>
              ) : (
                <UpcomingTab bookings={upcoming} onCancelled={refreshBookings} />
              )
            )}

            {active === "history" && (
              <HistoryTab
                state={historyState}
                truncated={historyTruncated}
                onLoadMore={loadMoreHistory}
                onRetry={refreshHistory}
                onReviewed={(id, review) => patchHistoryEntry(id, { review })}
              />
            )}

            {active === "courses" && <CoursesTab state={enrollmentsState} />}
          </div>
        </div>

        <aside className="pa-side">
          <BookSessionsPanel hasActivePack={hasActivePack} packSession={packSession} />
        </aside>
      </div>

      {session?.user?.email && (
        <DangerZone
          email={session.user.email}
          onGoToUpcoming={() => setActive("upcoming")}
        />
      )}
    </div>
  );
}
