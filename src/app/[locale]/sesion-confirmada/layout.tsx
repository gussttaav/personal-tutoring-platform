/**
 * SEO-02: transactional page — never an SEO target. The page itself is a
 * client component and cannot export metadata, so this pass-through layout
 * carries the robots override (the root layout sets index:true site-wide;
 * robots.txt disallow blocks crawling but not indexing of linked URLs).
 */

import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SesionConfirmadaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
