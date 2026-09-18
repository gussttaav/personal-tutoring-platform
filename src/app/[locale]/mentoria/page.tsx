/*
 * REDESIGN-P0-01 — /mentoria: the tutoring landing gets its own route.
 *
 * A COPY of `src/app/[locale]/page.tsx` as it stood when the redesign cycle started, not a
 * shared component: Phase 1 rewrites `/` section by section and Phase 2 rewrites this page
 * section by section, so a shared `LandingComposition` would be deleted two PRs later. The
 * duplication is temporary (P1-04 removes it from `/`) and `noindex` is what makes it
 * acceptable meanwhile — P2-04 lifts it, gives the page its own metadata keys and lists it in
 * the sitemap. `landing.meta` is reused for now.
 *
 * REDESIGN-P1-06: the booking shell is split — `BookingOverlays` (provider + the booking
 * screens, mounted on both pages) wraps `InteractiveShell` (the sessions/packs sections, this
 * page only). The `Suspense` boundary moved INSIDE the provider: the overlays don't read search
 * params, `RescheduleBridge` (mounted by the sections) does.
 */

import { Suspense } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Spinner } from "@/components/ui";
import HeroSection from "@/features/landing/HeroSection";
import BiographySection from "@/features/landing/BiographySection";
import SpecializationsSection from "@/features/landing/SpecializationsSection";
//import ConsultingSection from "@/features/landing/ConsultingSection";
import InteractiveShell from "@/features/booking/InteractiveShell";
import BookingOverlays from "@/features/booking/BookingOverlays";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StructuredData from "@/components/seo/StructuredData";
import { routing } from "@/i18n/routing";
import { localizedAlternates } from "@/lib/hreflang";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.meta" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: true },
    alternates: localizedAlternates("/mentoria", locale),
  };
}

export default async function MentoriaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Only InteractiveShell needs the Suspense boundary: it mounts RescheduleBridge, which
  // uses useSearchParams() (via useRescheduleIntent) and forces a client-side-rendering
  // bailout. Keeping the boundary scoped to it lets Navbar, the landing sections, and
  // Footer render on the server — so the content (incl. the Footer privacy/terms links) is
  // in the static HTML for crawlers and SEO, instead of being hidden behind a spinner shell.
  return (
    <>
      {/* SEO-04: JSON-LD (Person + Service) — server-rendered, outside the
          Suspense boundary so it ships in the prerendered HTML. */}
      <StructuredData locale={locale} />
      <Navbar />

      <main style={{ position: "relative", zIndex: 1 }}>
        <div
          className="landing-column"
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          <HeroSection />
          <BiographySection />
          <SpecializationsSection />

          <BookingOverlays>
            <Suspense
              fallback={
                <div
                  className="flex items-center justify-center"
                  style={{ minHeight: "60vh", position: "relative", zIndex: 1 }}
                >
                  <Spinner />
                </div>
              }
            >
              <InteractiveShell />
            </Suspense>
          </BookingOverlays>

          {/*
            <div
              style={{
                height: 1,
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
                margin: "64px 0",
              }}
            />

            <ConsultingSection />
          */}
        </div>

        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>
      </main>

      <Footer />
    </>
  );
}
