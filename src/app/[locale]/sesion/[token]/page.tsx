/**
 * /sesion/[token] — Pre-join setup + Zoom session room
 *
 * Server component. Verifies the booking token, gates on authentication,
 * and renders the PreJoinSetup component which handles device selection
 * before the Zoom Video SDK session starts.
 *
 * Access control:
 *  - Invalid/used token → redirect to homepage.
 *  - Valid token, not signed in → Google sign-in prompt with callbackUrl preserving the token.
 *  - Valid token, signed in → PreJoinSetup (device preview + "Entrar al aula").
 *
 * SEC-05: Only join tokens are accepted. Cancel tokens are rejected.
 */

import { redirect } from "next/navigation";
import { toZonedTime } from "date-fns-tz";
import { bookingService } from "@/services";
import { auth } from "@/auth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import PreJoinSetup from "@/components/PreJoinSetup";
import { getTranslations, setRequestLocale } from "next-intl/server";

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
  if (!record) redirect("/");

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

  // ── Authenticated ──────────────────────────────────────────────────────────
  return (
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
  );
}
