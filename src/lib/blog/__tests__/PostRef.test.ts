/*
 * BLOG-06 — Tests for the reference hover card.
 *
 * `findReference` is the whole of "nothing here is authored": whether a link gets a
 * card follows from whether its href is the SAME STRING as a `reading` entry's url —
 * no normalization, exactly the exact-match discipline `resolveTarget`
 * (src/lib/courses/Leccion.tsx) uses for slugs. The component around it is an async
 * Server Component that reads next-intl's request context; it is rendered here with
 * `getTranslations` replaced by the real message files, the same arrangement
 * leccion.test.ts uses for `<Leccion>`.
 */

import { renderToStaticMarkup } from "react-dom/server";

import type { ReadingItem } from "@/domain/types";

import { findReference, makePostLink } from "../PostRef";

jest.mock("next-intl/server", () => {
  // The real copy, so the assertions below read what the reader reads. `{name}` is the
  // only ICU feature `blog.reading` keys use, and these keys use none.
  const messages: Record<string, Record<string, Record<string, Record<string, string>>>> = {
    es: jest.requireActual("../../../../messages/es.json"),
    en: jest.requireActual("../../../../messages/en.json"),
  };
  return {
    getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
      const [a, b] = namespace.split(".");
      const ns = messages[locale][a][b];
      return (key: string) => {
        const parts = key.split(".");
        let value: unknown = ns;
        for (const part of parts) value = (value as Record<string, unknown>)[part];
        return value as string;
      };
    },
  };
});

const GAGE: ReadingItem = {
  kind: "paper",
  title: "A New Algorithm for Data Compression",
  authors: "Philip Gage",
  year: "1994",
  venue: "C Users Journal, archivado",
  lang: "en",
  url: "https://web.archive.org/web/20210329111703/http://www.pennelynn.com/Documents/CUJ/HTML/94HTML/19940045.HTM",
  note: "El origen de BPE, veintidós años antes de que sirviera para tokenizar.",
};

const OTHER: ReadingItem = {
  kind: "libro",
  title: "Speech and Language Processing",
  authors: "Jurafsky y Martin",
  venue: "stanford.edu",
  lang: "es",
  url: "https://web.stanford.edu/~jurafsky/slp3/2.pdf",
  note: "El capítulo de referencia sobre tokenización.",
};

describe("findReference", () => {
  it("matches an href against a reading entry's url", () => {
    expect(findReference([GAGE, OTHER], GAGE.url)).toBe(GAGE);
  });

  it("returns undefined for an href in neither entry", () => {
    expect(findReference([GAGE, OTHER], "https://arxiv.org/abs/1410.8206")).toBeUndefined();
  });

  it("returns undefined for an undefined href", () => {
    expect(findReference([GAGE, OTHER], undefined)).toBeUndefined();
  });

  it("is an exact string match — no trailing-slash or query normalization", () => {
    expect(findReference([GAGE], `${GAGE.url}/`)).toBeUndefined();
  });
});

async function render(reading: ReadingItem[], locale: string, href: string | undefined, children = "el enlace") {
  const PostLink = makePostLink({ reading, locale });
  return renderToStaticMarkup(await PostLink({ href, children }));
}

describe("makePostLink", () => {
  it("renders a plain link, unchanged, when the href matches no reading entry", async () => {
    const html = await render([GAGE], "es", "https://arxiv.org/abs/1410.8206");

    expect(html).toBe('<a href="https://arxiv.org/abs/1410.8206">el enlace</a>');
  });

  it("passes an undefined href straight through", async () => {
    expect(await render([GAGE], "es", undefined)).toBe("<a>el enlace</a>");
  });

  it("renders the card with kind, title, authors/year, venue and note for a match", async () => {
    const html = await render([GAGE, OTHER], "es", GAGE.url);

    expect(html).toContain(`<a href="${GAGE.url}" class="post-ref">el enlace</a>`);
    expect(html).toContain('<span class="post-ref-kicker">paper · En inglés</span>');
    expect(html).toContain('<span class="post-ref-title">A New Algorithm for Data Compression</span>');
    expect(html).toContain('<span class="post-ref-meta">Philip Gage, 1994 · C Users Journal, archivado</span>');
    expect(html).toContain(
      '<span class="post-ref-summary">El origen de BPE, veintidós años antes de que sirviera para tokenizar.</span>',
    );
  });

  it("shows the language badge only when the entry's language differs from the reader's", async () => {
    const inSpanish = await render([OTHER], "es", OTHER.url);
    const inEnglish = await render([OTHER], "en", OTHER.url);

    expect(inSpanish).not.toContain("post-ref-kicker\">libro · ");
    expect(inSpanish).toContain('<span class="post-ref-kicker">libro</span>');
    expect(inEnglish).toContain('<span class="post-ref-kicker">book · In Spanish</span>');
  });

  it("omits the year from the meta line when the entry has none", async () => {
    const html = await render([OTHER], "es", OTHER.url);

    expect(html).toContain('<span class="post-ref-meta">Jurafsky y Martin · stanford.edu</span>');
  });
});
