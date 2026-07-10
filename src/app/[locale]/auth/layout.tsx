/**
 * SEO-02: auth popup pages (signin-popup, popup-callback) — never an SEO
 * target. The pages are client components and cannot export metadata, so
 * this pass-through layout carries the robots override for the whole /auth
 * segment (the root layout sets index:true site-wide; robots.txt disallow
 * blocks crawling but not indexing of linked URLs).
 */

import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
