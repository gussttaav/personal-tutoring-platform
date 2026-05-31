/**
 * /area-personal — Student personal dashboard
 *
 * Server component. Auth-gated: unauthenticated users are redirected to sign in
 * with a callbackUrl that returns them here after authentication.
 *
 * Renders the Navbar + PersonalArea client component which handles all
 * dynamic data fetching (bookings, pack credits) and state rendering.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PersonalArea from "@/features/personal-area/PersonalArea";

export const metadata = {
  title: "Área Personal — Gustavo Torres",
  description: "Gestiona tus sesiones reservadas, clases de pack y reserva nuevas sesiones.",
};

export default async function AreaPersonalPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect(
      `/api/auth/signin?callbackUrl=${encodeURIComponent("/area-personal")}`
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#131315" }}>
      <Navbar />
      <main className="flex-1 pt-16">
        <PersonalArea />
      </main>
      <Footer />
    </div>
  );
}
