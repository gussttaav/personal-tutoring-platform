/**
 * SEO-04: JSON-LD structured data for the site's two hub pages (schema.org).
 *
 * Server component — the <script> tag ships in the prerendered HTML so
 * crawlers see it without executing JS (JSON-LD is inert, no CSP concern).
 *
 * The Service is deliberately price-free: session/pack prices live in the DB
 * (PricingService) and embedding them here risks stale structured data,
 * which Google penalizes. If offers are ever wanted, feed them from
 * getDisplayPrices() (already loaded in the root layout).
 *
 * REDESIGN-P1-05: split by `variant` now that home and /mentoria are
 * separate pages. `home` emits the `Person` only (the site's identity,
 * which belongs on the entrance page). `mentoria` references that same
 * Person by `@id` and adds the `Service` (the tutoring offer, which belongs
 * on the page that sells it). Both `@id`s (`#person`, `#service`) are kept
 * stable across variants so the graph stays linkable.
 *
 * REDESIGN-P2-01: `jobTitle` reads `home.hero.jobTitle`. The value used to be
 * the old Mentoría hero's `subtitle` line; that hero is deleted and the JSON-LD
 * was its only remaining reader, so the key moved to where the value now
 * belongs (the home, which carries the Person).
 */

import { getTranslations } from "next-intl/server";
import { localeUrl } from "@/lib/hreflang";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gustavoai.dev";

export default async function StructuredData({
  locale,
  variant,
}: {
  locale: string;
  variant: "home" | "mentoria";
}) {
  if (variant === "home") {
    const t = await getTranslations({ locale, namespace: "home.hero" });
    const url = locale === "en" ? `${BASE}/en` : BASE;

    const person = {
      "@type": "Person",
      "@id": `${BASE}/#person`,
      name: "Gustavo Torres",
      jobTitle: t("jobTitle"),
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

    const json = { "@context": "https://schema.org", "@graph": [person] };

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
      />
    );
  }

  // variant === "mentoria": `meta.mentoria.*` lands in REDESIGN-P2-04; until
  // then this falls back to `landing.meta.*`.
  const tMeta = await getTranslations({ locale, namespace: "meta" });
  const tLanding = await getTranslations({ locale, namespace: "landing" });
  const name = tMeta.has("mentoria.title") ? tMeta("mentoria.title") : tLanding("meta.title");
  const description = tMeta.has("mentoria.description")
    ? tMeta("mentoria.description")
    : tLanding("meta.description");
  const url = localeUrl("/mentoria", locale);

  const json = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Person", "@id": `${BASE}/#person` },
      {
        "@type": "Service",
        "@id": `${BASE}/#service`,
        name,
        serviceType: "Tutoring",
        description,
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
