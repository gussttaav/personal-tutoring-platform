/**
 * SEO-04: JSON-LD structured data for the home page (schema.org).
 *
 * Server component — the <script> tag ships in the prerendered HTML so
 * crawlers see it without executing JS (JSON-LD is inert, no CSP concern).
 *
 * Shape: Person + Service under one @graph. Deliberately price-free:
 * session/pack prices live in the DB (PricingService) and embedding them
 * here risks stale structured data, which Google penalizes. If offers are
 * ever wanted, feed them from getDisplayPrices() (already loaded in the
 * root layout).
 */

import { getTranslations } from "next-intl/server";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gustavoai.dev";

export default async function StructuredData({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "landing" });
  const url = locale === "en" ? `${BASE}/en` : BASE;

  const person = {
    "@type": "Person",
    "@id": `${BASE}/#person`,
    name: "Gustavo Torres",
    jobTitle: t("hero.subtitle"),
    url,
    image: `${BASE}/avatar.png`,
    knowsAbout: [
      "Java",
      "Python",
      "C",
      "Algorithms",
      "Deep Learning",
      "Statistics",
      "Mathematics",
      "Artificial Intelligence",
    ],
    sameAs: [
      "https://www.linkedin.com/in/gustavo-torres-guerrero",
      "https://www.classgap.com/es/tutor/gustavo-torres-guerrero",
    ],
  };

  const json = {
    "@context": "https://schema.org",
    "@graph": [
      person,
      {
        "@type": "Service",
        "@id": `${BASE}/#service`,
        name: t("meta.title"),
        serviceType: "Tutoring",
        description: t("meta.description"),
        provider: { "@id": `${BASE}/#person` },
        url,
        availableLanguage: ["es", "en"],
        areaServed: "Online",
        inLanguage: locale,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
