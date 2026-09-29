import type { Metadata, Viewport } from "next";
import { Manrope, Inter, Newsreader } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import AuthProvider from "@/components/AuthProvider";
import { routing } from "@/i18n/routing";
import { localizedAlternates } from "@/lib/hreflang";
import "../globals.css";

/**
 * layout.tsx — Emerald Nocturne redesign
 *
 * Font update:
 *   - Headlines: Manrope (was DM Serif Display / DM Sans)
 *   - Body/UI:   Inter (was DM Sans)
 *
 * CSS variables exposed:
 *   --font-headline  → Manrope
 *   --font-body      → Inter
 *   --font-serif     → Newsreader (editorial display serif — course landing headings)
 *
 * All existing logic (AuthProvider, Analytics, metadata) is unchanged.
 *
 * REFACTOR-R4-P2-02: the Material Symbols font is a ~15 KB SUBSET (was the full 3.9 MB
 * variable font, preloaded on every page). See the note on `materialSymbols` below.
 *
 * REFACTOR-R4-P2-03: no commerce data here any more. Prices, pack validity and the
 * booking schedule (+ `UserPricingSync`) moved to `CommerceProviders`
 * (src/components/commerce/), which only the booking pages mount. Loading them here
 * made every lesson and post read Supabase at build time and carry the
 * `pricing-all` / `schedule-config` ISR tags.
 */

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-headline",
  weight: ["600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  weight: ["300", "400", "500", "600"],
});

// Editorial display serif for the course-landing headings (COURSE landing redesign).
// Italic is load-bearing — the hero and closing CTA lean on the italic cut for accent.
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

// Material Symbols icon font — self-hosted via next/font/local (not in the
// next/font/google catalog). REFACTOR-R4-P2-02: a SUBSET holding only the icons in
// `src/constants/icons.ts`, with wght 400 / GRAD 0 / opsz 24 pinned and FILL kept as
// the one variable axis. To add an icon: add its name to ICON_NAMES, run
// `pnpm build:icons`, commit the new woff2 + manifest (`pnpm check:icons` enforces it).
// An icon missing from the subset renders as its ligature word, not the glyph.
const materialSymbols = localFont({
  src: "./fonts/material-symbols-outlined.woff2", // SUBSET — see src/constants/icons.ts
  display: "block",
  variable: "--font-icon",
  weight: "400",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.root" });
  // SEO-03: locale-specific share image (credential + credibility stats are
  // baked into the PNG, so each locale needs its own). Spanish is the default
  // (`/og.png`); English uses `/og-en.png`.
  const ogImage = locale === "en" ? "/og-en.png" : "/og.png";
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "https://gustavoai.dev"),
    title: t("title"),
    description: t("description"),
    robots: { index: true, follow: true },
    alternates: localizedAlternates("", locale),
    // SEO-03: OpenGraph + Twitter cards for social/link previews. Relative
    // URLs resolve against metadataBase; the og image is a static asset
    // (bypasses the intl middleware via its extension check).
    openGraph: {
      type: "website",
      siteName: "gustavoai.dev",
      title: t("title"),
      description: t("description"),
      url: locale === "en" ? "/en" : "/",
      locale: locale === "en" ? "en_US" : "es_ES",
      alternateLocale: locale === "en" ? "es_ES" : "en_US",
      images: [{ url: ogImage, width: 1200, height: 630, alt: t("title") }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [ogImage],
    },
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", sizes: "any" },
      ],
      apple: "/apple-touch-icon.png",
      shortcut: "/favicon.svg",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#131315",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} data-scroll-behavior="smooth" className={`dark ${manrope.variable} ${inter.variable} ${newsreader.variable} ${materialSymbols.variable}`}>
      <head>
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          {/* REFACTOR-R4-P2-03: stays above every page — the Navbar needs the
              session, and so does the `UserPricingSync` inside CommerceProviders. */}
          <AuthProvider>{children}</AuthProvider>
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
