// REDESIGN-P0-01: `mentoria/page.tsx` was a verbatim copy of this composition when the cycle
// started — temporary, until P1-04 rewrites `/` as the static home and the duplicate stops being
// one. REDESIGN-P1-01: the hero is `HomeHero` (features/home) here; `HeroSection` still serves
// /mentoria. REDESIGN-P1-02: `BiographySection` + `SpecializationsSection` are replaced by the
// compact `HomeBio` + `HomeAreas` pair, wrapped in one two-column `<section>`; both landing
// components still serve /mentoria unchanged. REDESIGN-P1-03: `HomeCourses` + `HomePosts` add
// the courses and latest-posts bands, reusing `CourseCard` / `PostCard` and their catalog/blog
// selectors as-is. REDESIGN-P1-06: `BookingOverlays` (the booking provider + screens) is mounted
// on both pages, so the hero's CTAs open the calendar / booking in place on `/`.
// REDESIGN-P1-04: `/` is the finished, fully STATIC home — hero → bio + areas → courses → posts
// → closing band (the app showcase was later removed from `/`; it still mounts on /mentoria,
// P2-03). The sessions/packs sections (`InteractiveShell`) and their `Suspense` boundary (the
// `useSearchParams` bailout, via `RescheduleBridge`) live on /mentoria only; nothing here reads
// search params. The booking overlays stay mounted, alone (their one child is `HomeChat`, the
// chat FAB, which the sections rendered until now — see that file for why it sits inside the
// provider). `ClosingCta` is a shared component (src/components/) because /mentoria mounts it too.
// REDESIGN-P1-05: `generateMetadata` reads `home.meta.*`, its own title/description, and
// `StructuredData` takes `variant="home"`, which drops the `Service` JSON-LD — it belongs
// on /mentoria, the page that sells it.
// LANDING-01: this static home is what anonymous visitors (and Googlebot) get, and what a
// signed-in visitor reaches from inside the app («Inicio», the logo). A request that LANDS here
// with a session cookie (typed URL, bookmark, external link) is rewritten by src/middleware.ts to
// the dynamic twin at /inicio, which resolves the visitor's real landing; it renders this same
// page when the cookie is stale.

import { setRequestLocale, getTranslations } from "next-intl/server";
import HomeHero from "@/features/home/HomeHero";
import HomeBio from "@/features/home/HomeBio";
import HomeAreas from "@/features/home/HomeAreas";
import HomeCourses from "@/features/home/HomeCourses";
import HomePosts from "@/features/home/HomePosts";
//import ConsultingSection from "@/features/landing/ConsultingSection";
import BookingOverlays from "@/features/booking/BookingOverlays";
import ClosingCta from "@/components/ClosingCta";
import HomeChat from "@/components/HomeChat";
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
  const t = await getTranslations({ locale, namespace: "home.meta" });
  const title = t("title");
  const description = t("description");
  // REDESIGN-P1-05: `openGraph` is not deep-merged with the layout's — copy
  // its shared fields and override title/description so the share card
  // matches the tab instead of silently inheriting `meta.root`.
  const ogImage = locale === "en" ? "/og-en.png" : "/og.png";
  return {
    title,
    description,
    alternates: localizedAlternates("", locale),
    openGraph: {
      type: "website",
      siteName: "gustavoai.dev",
      title,
      description,
      url: locale === "en" ? "/en" : "/",
      locale: locale === "en" ? "en_US" : "es_ES",
      alternateLocale: locale === "en" ? "es_ES" : "en_US",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      {/* SEO-04: JSON-LD (Person + Service) — server-rendered so it ships in the
          prerendered HTML. */}
      <StructuredData locale={locale} variant="home" />
      <Navbar />

      <main style={{ position: "relative", zIndex: 1 }}>
        <div
          className="landing-column"
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
            // The home ends on the closing band and the footer's own 80px margin is the gap
            // (design `.column` has no bottom padding); `.landing-column`'s 80px stays for /mentoria.
            paddingBottom: 0,
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

          <section className="home-closing">
            <ClosingCta locale={locale} />
          </section>

          <BookingOverlays>
            <HomeChat />
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
