import { Suspense } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Spinner } from "@/components/ui";
import HeroSection from "@/features/landing/HeroSection";
import BiographySection from "@/features/landing/BiographySection";
import SpecializationsSection from "@/features/landing/SpecializationsSection";
//import ConsultingSection from "@/features/landing/ConsultingSection";
import InteractiveShell from "@/features/booking/InteractiveShell";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { localizedAlternates } from "@/lib/hreflang";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.meta" });
  return { title: t("title"), description: t("description"), alternates: localizedAlternates("", locale) };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Only InteractiveShell needs the Suspense boundary: it uses useSearchParams()
  // (via useRescheduleIntent), which forces a client-side-rendering bailout. Keeping
  // the boundary scoped to it lets Navbar, the landing sections, and Footer render on
  // the server — so the content (incl. the Footer privacy/terms links) is in the
  // static HTML for crawlers and SEO, instead of being hidden behind a spinner shell.
  return (
    <>
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
