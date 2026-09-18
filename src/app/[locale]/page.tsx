// REDESIGN-P0-01: `mentoria/page.tsx` was a verbatim copy of this composition when the cycle
// started — temporary, until P1-04 rewrites `/` as the static home and the duplicate stops being
// one. REDESIGN-P1-01: the hero is `HomeHero` (features/home) here; `HeroSection` still serves
// /mentoria. REDESIGN-P1-02: `BiographySection` + `SpecializationsSection` are replaced by the
// compact `HomeBio` + `HomeAreas` pair, wrapped in one two-column `<section>`; both landing
// components still serve /mentoria unchanged. REDESIGN-P1-03: `HomeCourses` + `HomePosts` add
// the courses and latest-posts bands, reusing `CourseCard` / `PostCard` and their catalog/blog
// selectors as-is. REDESIGN-P1-06: `BookingOverlays` (the booking provider + screens, mounted on
// both pages) wraps the shell, so the hero's CTAs open the calendar / booking in place on `/`;
// the shell itself is now only the sessions/packs sections and still sits here until P1-04
// replaces the whole block with `<BookingOverlays />` alone.

import { Suspense } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Spinner } from "@/components/ui";
import HomeHero from "@/features/home/HomeHero";
import HomeBio from "@/features/home/HomeBio";
import HomeAreas from "@/features/home/HomeAreas";
import HomeCourses from "@/features/home/HomeCourses";
import HomePosts from "@/features/home/HomePosts";
//import ConsultingSection from "@/features/landing/ConsultingSection";
import InteractiveShell from "@/features/booking/InteractiveShell";
import BookingOverlays from "@/features/booking/BookingOverlays";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StructuredData from "@/components/seo/StructuredData";
import { localizedAlternates } from "@/lib/hreflang";
import "@/features/courses/course-editorial.css";
import "@/features/courses/catalog/catalog.css";
import "@/features/blog/blog.css";
import "@/features/home/home.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.meta" });
  return { title: t("title"), description: t("description"), alternates: localizedAlternates("", locale) };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
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
          <HomeHero locale={locale} />

          <section
            className="home-bio-grid"
            style={{
              padding: "72px 0",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              animation: "fadeUp 0.7s ease both 0.15s",
            }}
          >
            <HomeBio locale={locale} />
            <HomeAreas locale={locale} />
          </section>

          <HomeCourses locale={locale} />
          <HomePosts locale={locale} />

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
