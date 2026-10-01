/**
 * SEO-02: transactional page — never an SEO target. The page itself is a
 * client component and cannot export metadata, so this pass-through layout
 * carries the robots override (the root layout sets index:true site-wide;
 * robots.txt disallow blocks crawling but not indexing of linked URLs).
 *
 * REFACTOR-R4-P2-03: also mounts `CommerceProviders`. The page reads `useSessionPriceLabel`,
 * which the root layout no longer provides, and it is a client component, so it
 * cannot render the (async, server) provider itself.
 */

import type { Metadata } from "next";
import { CommerceProviders } from "@/components/commerce/CommerceProviders";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SesionConfirmadaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <CommerceProviders locale={locale}>{children}</CommerceProviders>;
}
