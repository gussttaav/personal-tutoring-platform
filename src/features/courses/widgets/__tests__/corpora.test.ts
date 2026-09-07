/*
 * COURSE-P11-02 — The per-locale corpora, and the two invariants that keep the widget
 * messages honest.
 *
 * Three jobs, and the middle one is the reason this file exists rather than a note in a
 * task doc:
 *
 *   1. SELECTION — `widgetCorpus` returns the locale's entry, and falls back to `es` for
 *      a locale with none.
 *   2. THE TEACHING PROPERTY — each corpus is checked against the property written next
 *      to it in corpora.ts, by running the same pure functions the widget runs. Choosing
 *      a corpus is a pedagogical decision; this is what stops a later edit from picking a
 *      sentence that reads beautifully and demonstrates nothing.
 *   3. NO DRIFT — the Spanish widget messages are pinned to the Spanish data still living
 *      in `math/transformer-architecture.ts` and `math/multi-head.ts`. Those modules keep
 *      their strings because the layout and rule tests measure them; the components read
 *      `messages` instead. Two copies of one sentence is a drift hazard, so it is
 *      asserted rather than trusted.
 *
 * `messages/*.json` is read from disk rather than imported, so this test sees exactly the
 * file the app ships.
 */

import fs from "node:fs";
import path from "node:path";

import {
  SPANISH_BOUND_CORPORA,
  WIDGET_CORPORA,
  widgetCorpus,
  type CorpusWidgetId,
} from "@/features/courses/widgets/corpora";
import { buildBagOfWords, MAX_TOKENS_PER_DOC } from "@/features/courses/widgets/math/bag-of-words";
import { HEADS } from "@/features/courses/widgets/math/multi-head";
import {
  MAX_LABEL_CHARS,
  TRANSFORMER_COMPONENTS,
  type LessonRef,
} from "@/features/courses/widgets/math/transformer-architecture";
import {
  tokenizeChars,
  tokenizeSubwords,
  tokenizeWords,
  CONTINUATION,
} from "@/features/courses/widgets/math/tokenisation";
import { WIDGET_IDS } from "@/features/courses/widgets/widget-ids";

type Json = { [key: string]: Json | string };

function messages(locale: string): Json {
  const file = path.join(process.cwd(), "messages", `${locale}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as Json;
}

function widgetMessages(locale: string): Json {
  const courses = messages(locale).courses as Json;
  return courses.widgets as Json;
}

/** Every leaf path of a message tree, so two locales can be compared key-for-key. */
function keyPaths(tree: Json, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const here = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [here] : keyPaths(value, here);
  });
}

function at(tree: Json, dotted: string): string {
  const value = dotted.split(".").reduce<Json | string>((node, key) => (node as Json)[key], tree);
  if (typeof value !== "string") throw new Error(`corpora.test: ${dotted} is not a message`);
  return value;
}

const ES = widgetMessages("es");
const EN = widgetMessages("en");

describe("widget corpora — selection", () => {
  const ids = Object.keys(WIDGET_CORPORA) as CorpusWidgetId[];

  it.each(ids)("%s returns the Spanish corpus for es and the English one for en", (id) => {
    expect(widgetCorpus(id, "es")).toEqual(WIDGET_CORPORA[id].byLocale.es);
    expect(widgetCorpus(id, "en")).toEqual(WIDGET_CORPORA[id].byLocale.en);
    expect(widgetCorpus(id, "en")).not.toEqual(widgetCorpus(id, "es"));
  });

  it.each(ids)("%s falls back to the default locale for a locale with no entry", (id) => {
    // A locale the app does not serve, and the empty string — neither may return undefined.
    expect(widgetCorpus(id, "de")).toEqual(WIDGET_CORPORA[id].byLocale.es);
    expect(widgetCorpus(id, "")).toEqual(WIDGET_CORPORA[id].byLocale.es);
  });

  it("writes down the teaching property of every corpus", () => {
    for (const id of ids) {
      expect(WIDGET_CORPORA[id].property.length).toBeGreaterThan(40);
    }
  });

  it("names real widgets in SPANISH_BOUND_CORPORA, and none that has a corpus here", () => {
    for (const [id, reason] of Object.entries(SPANISH_BOUND_CORPORA)) {
      expect(WIDGET_IDS).toContain(id);
      expect(ids).not.toContain(id);
      expect(reason.length).toBeGreaterThan(40);
    }
  });
});

describe("widget corpora — tokenizer-playground keeps its teaching property", () => {
  const entry = WIDGET_CORPORA["tokenizer-playground"].byLocale;

  it.each(Object.keys(entry))("in %s the three tokenisers visibly disagree", (locale) => {
    const text = entry[locale];
    const words = tokenizeWords(text);
    const chars = tokenizeChars(text);
    const subwords = tokenizeSubwords(text);

    expect(words.length).toBeLessThan(subwords.length);
    expect(subwords.length).toBeLessThan(chars.length);
  });

  it.each(Object.keys(entry))("in %s at least one word splits into subword pieces", (locale) => {
    const pieces = tokenizeSubwords(entry[locale]).filter((p) => p.startsWith(CONTINUATION));
    // A continuation piece is BPE saying "this belongs to the word before it", which is
    // the whole thing the `##` column exists to show.
    expect(pieces.length).toBeGreaterThan(0);
  });

  it.each(Object.keys(entry))("in %s one character exercises NFC", (locale) => {
    const text = entry[locale];
    // A precomposed letter: two code points when decomposed, one when normalised — so
    // character-level tokenisation returns it whole rather than splitting off the mark.
    const precomposed = Array.from(text).filter((ch) => ch.normalize("NFD").length > 1);
    expect(precomposed.length).toBeGreaterThan(0);
    for (const ch of precomposed) {
      expect(tokenizeChars(text)).toContain(ch);
    }
  });
});

describe("widget corpora — bag-of-words keeps its teaching property", () => {
  const entry = WIDGET_CORPORA["bag-of-words"].byLocale;

  it.each(Object.keys(entry))("in %s both documents fit the token cap", (locale) => {
    for (const doc of buildBagOfWords([...entry[locale]]).documents) {
      expect(doc.truncated).toBe(false);
      expect(doc.tokens.length).toBeLessThanOrEqual(MAX_TOKENS_PER_DOC);
    }
  });

  it.each(Object.keys(entry))(
    "in %s each document is dominated by one entry at 4, every other at 1",
    (locale) => {
      for (const doc of buildBagOfWords([...entry[locale]]).documents) {
        const present = doc.sum.filter((n) => n > 0);
        expect(present.filter((n) => n === 4)).toHaveLength(1);
        expect(present.filter((n) => n !== 4).every((n) => n === 1)).toBe(true);
      }
    },
  );

  it.each(Object.keys(entry))(
    "in %s the corpus row is topped by function words, every content word at 1",
    (locale) => {
      const { total } = buildBagOfWords([...entry[locale]]);
      const repeated = total.filter((n) => n > 1);
      // At most four entries occur more than once across the corpus — the repeated
      // article plus the shared function words. Everything else is a content word at 1,
      // which is what makes the corpus row say something the document sums cannot.
      expect(repeated.length).toBeLessThanOrEqual(4);
      expect(Math.max(...total)).toBeGreaterThanOrEqual(4);
    },
  );
});

describe("widget messages", () => {
  it("are key-for-key identical in es and en", () => {
    expect(keyPaths(ES).sort()).toEqual(keyPaths(EN).sort());
  });

  it("keep the Spanish transformer labels and descriptions pinned to the maths module", () => {
    for (const c of TRANSFORMER_COMPONENTS) {
      expect(at(ES, `transformer-architecture.boxes.${c.id}.label`).split("\n")).toEqual(c.label);
      expect(at(ES, `transformer-architecture.boxes.${c.id}.description`)).toBe(c.description);
    }
  });

  it("keep the Spanish lesson topics pinned to the maths module", () => {
    const refs: LessonRef[] = TRANSFORMER_COMPONENTS.flatMap((c) => [c.lesson, ...c.alsoLessons]);
    for (const ref of refs) {
      expect(at(ES, `transformer-architecture.topics.b${ref.block}l${ref.lesson}`)).toBe(ref.topic);
    }
  });

  it("draws every English transformer label inside its box", () => {
    for (const c of TRANSFORMER_COMPONENTS) {
      const lines = at(EN, `transformer-architecture.boxes.${c.id}.label`).split("\n");
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.length).toBeLessThanOrEqual(2);
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(MAX_LABEL_CHARS);
      }
    }
  });

  it("keep the Spanish head names pinned to the maths module", () => {
    HEADS.forEach((head, r) => {
      expect(at(ES, `multi-head-view.heads.${r}.short`)).toBe(head.short);
      expect(at(ES, `multi-head-view.heads.${r}.name`)).toBe(head.name);
    });
  });
});
