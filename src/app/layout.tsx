import type { Metadata, Viewport } from "next";
import { Manrope, Inter } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Gustavo Torres — Profesor & Consultor",
  description:
    "Clases de programación, matemáticas e IA. Reserva una sesión o adquiere un pack de horas con descuento.",
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
    <html lang="es" className={`dark ${manrope.variable} ${inter.variable}`}>
      <head>
        <link rel="manifest" href="/site.webmanifest" />
        {/* Preconnect so the font request starts immediately */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Material Symbols — display=block hides text until icons load (avoids "expand_more" as raw text) */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block"
        />
      </head>
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
