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
import { toZonedTime, format } from "date-fns-tz";
import { resolveJoinToken } from "@/infrastructure/redis/booking-tokens";
import { auth } from "@/auth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import PreJoinSetup from "@/components/PreJoinSetup";

const SESSION_LABELS: Record<string, string> = {
  free15min: "Encuentro inicial gratuito · 15 min",
  session1h: "Sesión individual · 1 hora",
  session2h: "Sesión individual · 2 horas",
  pack:      "Clase de pack",
};

const TZ = "Europe/Madrid";

function formatSessionTime(iso: string): string {
  const zoned = toZonedTime(new Date(iso), TZ);
  return format(zoned, "d 'de' MMMM, HH:mm", { timeZone: TZ });
}

export default async function SesionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const record = await resolveJoinToken(token);
  if (!record) redirect("/");

  const sessionLabel = SESSION_LABELS[record.sessionType] ?? record.sessionType;
  const timeLabel    = formatSessionTime(record.startsAt);

  // ── Auth gate ──────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.email) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-on-surface-variant">
              Inicia sesión para acceder a tu sesión.
            </p>
            <GoogleSignInButton
              callbackUrl={`/sesion/${token}`}
              label="Continuar con Google"
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
