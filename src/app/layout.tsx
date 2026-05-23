import type { Metadata, Viewport } from "next";
import { Manrope, Inter } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import AuthProvider from "@/components/AuthProvider";
import "./globals.css";

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
 *
 * All existing logic (AuthProvider, Analytics, metadata) is unchanged.
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

// Material Symbols icon font — self-hosted via next/font/local (not in the
// next/font/google catalog). Full variable woff2 (opsz/wght/FILL/GRAD axes),
// so the .material-symbols-outlined font-variation-settings keep working.
const materialSymbols = localFont({
  src: "./fonts/material-symbols-outlined.woff2",
  display: "block",
  variable: "--font-icon",
  weight: "100 700",
});

export const metadata: Metadata = {
  title: "Gustavo Torres - Tutorías de programación, matemáticas e IA",
  description:
    "Clases de programación, matemáticas e IA con Gustavo Torres.",
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#131315",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" data-scroll-behavior="smooth" className={`dark ${manrope.variable} ${inter.variable} ${materialSymbols.variable}`}>
      <head>
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
