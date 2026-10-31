/**
 * /sesion/[token] — Pre-join setup + Zoom session room
 *
 * Server component. Verifies the booking token, gates on authentication,
 * and renders the PreJoinSetup component which handles device selection
 * before the Zoom Video SDK session starts.
 *
 * Access control:
 *  - Invalid/used token → "this class is no longer available" screen (SESSION-JOIN-01;
 *    was a silent redirect to `/`, which bounced signed-in users to their landing).
 *  - Valid token, not signed in → Google sign-in prompt with callbackUrl preserving the token.
 *  - Valid token, signed in → PreJoinSetup (device preview + "Entrar al aula").
 *
 * SEC-05: Only join tokens are accepted. Cancel tokens are rejected.
 * SEO-02: robots noindex — tokenized session URLs must never appear in
 * search results (robots.txt disallow blocks crawling but not indexing).
 *
 * REFACTOR-R4-P2-03: the signed-in tree is wrapped in `CommerceProviders`.
 * PreJoinSetup mounts PackBookingOverlay, whose BookingModeView reads the booking
 * schedule, which the root layout no longer provides. The sign-in prompt books
 * nothing, so it goes without (its footer modal fetches `/api/policy` on open).
 *
 * SESSION-JOIN-01: a signed-in student before the classroom opens
 * (start − booking_settings.join_open_minutes_before) sees ClassroomNotOpenYet,
 * which refreshes this page when it opens. The admin (tutor) may enter any time.
 * SessionService.issueJoinToken enforces the same rule server-side.
 */

import type { Metadata } from "next";
import { toZonedTime } from "date-fns-tz";
import { bookingService } from "@/services";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { getScheduleConfig } from "@/lib/schedule-config";
import { DEFAULT_JOIN_OPEN_MINUTES, joinOpensAtMs } from "@/lib/booking-config";
import { ClassroomNotOpenYet, ClassroomUnavailable } from "@/components/ClassroomStatus";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import PreJoinSetup from "@/components/PreJoinSetup";
import { CommerceProviders } from "@/components/commerce/CommerceProviders";
import { getTranslations, setRequestLocale } from "next-intl/server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const TZ = "Europe/Madrid";

function formatSessionTime(iso: string, locale: string): string {
  const date = toZonedTime(new Date(iso), TZ);
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "es-ES", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function SesionPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.sesion");

  const record = await bookingService.getJoinInfo(token);
  if (!record) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
        <ClassroomUnavailable />
        <Footer />
      </div>
    );
  }

  const SESSION_LABELS: Record<string, string> = {
    free15min: t("free"),
    session1h: t("session1h"),
    session2h: t("session2h"),
    pack:      t("pack"),
  };

  const sessionLabel = SESSION_LABELS[record.sessionType] ?? record.sessionType;
  const timeLabel    = formatSessionTime(record.startsAt, locale);

  // ── Auth gate ──────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.email) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-on-surface-variant">{t("signIn")}</p>
            <GoogleSignInButton
              callbackUrl={`/sesion/${token}`}
              label={t("continueGoogle")}
              fullWidth={false}
            />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Too early (SESSION-JOIN-01) ────────────────────────────────────────────
  if (!isAdmin(session)) {
    const schedule  = await getScheduleConfig();
    const opensAtMs = joinOpensAtMs(record.startsAt, schedule);
    // eslint-disable-next-line react-hooks/purity -- Server Component: renders once per request.
    if (Date.now() < opensAtMs) {
      return (
        <div className="flex flex-col min-h-screen bg-background">
          <Navbar />
          <ClassroomNotOpenYet
            startIso={record.startsAt}
            opensAtIso={new Date(opensAtMs).toISOString()}
            sessionLabel={sessionLabel}
            openMinutesBefore={schedule.joinOpenMinutesBefore ?? DEFAULT_JOIN_OPEN_MINUTES}
          />
          <Footer />
        </div>
      );
    }
  }

  // ── Authenticated ──────────────────────────────────────────────────────────
  return (
    <CommerceProviders locale={locale}>
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
        <PreJoinSetup
          eventId={record.eventId}
          userName={record.name}
          sessionLabel={sessionLabel}
          timeLabel={timeLabel}
        />
        <Footer />
      </div>
    </CommerceProviders>
  );
}
