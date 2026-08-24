// COURSE-P6-01 — hreflang alternates.
//
// `availableLocaleAlternates` must advertise only the locales content exists in,
// so a Spanish-only course never links an `/en/...` URL that 404s. The existing
// `localizedAlternates` (for pages that exist in both languages) must stay
// byte-identical — a regression there would silently change every canonical page's
// hreflang.

import { availableLocaleAlternates, localizedAlternates } from "@/lib/hreflang";

describe("availableLocaleAlternates", () => {
  it("Spanish-only content: emits es + x-default=es, and NO en key", () => {
    const { canonical, languages } = availableLocaleAlternates("/cursos/dl-nlp", "es", ["es"]);
    expect(canonical).toBe("/cursos/dl-nlp");
    expect(languages).toEqual({
      es: "/cursos/dl-nlp",
      "x-default": "/cursos/dl-nlp",
    });
    expect(languages).not.toHaveProperty("en");
  });

  it("both locales present: emits es + en, x-default=en (SEO-05 convention)", () => {
    const es = availableLocaleAlternates("/cursos/dl-nlp/intro", "es", ["es", "en"]);
    expect(es.canonical).toBe("/cursos/dl-nlp/intro");
    expect(es.languages).toEqual({
      es: "/cursos/dl-nlp/intro",
      en: "/en/cursos/dl-nlp/intro",
      "x-default": "/en/cursos/dl-nlp/intro",
    });

    // The English variant keeps the same language set but a locale-specific canonical.
    const en = availableLocaleAlternates("/cursos/dl-nlp/intro", "en", ["es", "en"]);
    expect(en.canonical).toBe("/en/cursos/dl-nlp/intro");
    expect(en.languages).toEqual(es.languages);
  });

  it("no available locales: emits no language keys (route effectively absent)", () => {
    const { languages } = availableLocaleAlternates("/cursos/dl-nlp", "es", []);
    expect(languages).toEqual({});
  });
});

describe("localizedAlternates is unchanged (regression guard)", () => {
  it("keeps the two-locale es/en/x-default output byte-for-byte", () => {
    expect(localizedAlternates("/privacidad", "es")).toEqual({
      canonical: "/privacidad",
      languages: {
        es: "/privacidad",
        en: "/en/privacidad",
        "x-default": "/en/privacidad",
      },
    });

    // Home route + English locale: es collapses to "/", canonical is the /en URL.
    expect(localizedAlternates("", "en")).toEqual({
      canonical: "/en",
      languages: {
        es: "/",
        en: "/en",
        "x-default": "/en",
      },
    });
  });
});
