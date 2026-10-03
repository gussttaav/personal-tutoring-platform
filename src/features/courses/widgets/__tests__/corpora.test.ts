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
import {
  BPE_WIDGET_MAX_MERGES,
  BPE_WIDGET_MIN_FREQ,
  N_BYTES,
  encode,
  tokenLabel,
  trainBpe,
  utf8,
  vocabulary,
} from "@/features/courses/widgets/math/bpe-merges";
import { renderSpecial, renderText } from "@/features/courses/widgets/math/chat-template";
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
      // COURSE-C2-P0-03: a `/` key is a course asset under public/, not a widget id —
      // it has to exist on disk, exactly as a widget id has to exist in WIDGET_IDS.
      if (id.includes("/")) {
        expect(fs.existsSync(path.join(process.cwd(), "public", id))).toBe(true);
      } else {
        expect(WIDGET_IDS).toContain(id);
      }
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

describe("widget corpora — bpe-merges keeps its teaching property", () => {
  const entry = WIDGET_CORPORA["bpe-merges"].byLocale;
  const run = (locale: string) => {
    const { corpus, sentence } = entry[locale];
    const { merges, stop } = trainBpe(corpus, BPE_WIDGET_MAX_MERGES, BPE_WIDGET_MIN_FREQ);
    const vocab = vocabulary(merges);
    const spell = (id: number) => tokenLabel(vocab[id]).text;
    return { corpus, sentence, merges, stop, vocab, spell };
  };

  it.each(Object.keys(entry))("in %s merge 1 fuses the two bytes of one letter", (locale) => {
    const { merges, spell } = run(locale);
    const [a, b] = merges[0].pair;
    expect(a).toBeGreaterThanOrEqual(0xc2); // a UTF-8 lead byte…
    expect(b).toBeGreaterThanOrEqual(0x80); // …and its continuation byte
    expect(b).toBeLessThan(0xc0);
    expect(tokenLabel([a]).valid).toBe(false);
    expect(Array.from(spell(merges[0].id))).toHaveLength(1);
  });

  it.each(Object.keys(entry))("in %s a suffix is built by later merges", (locale) => {
    const { merges, spell } = run(locale);
    expect(merges.map((m) => spell(m.id))).toContain(locale === "es" ? "ción" : "tion");
  });

  it.each(Object.keys(entry))(
    "in %s the sentence has unseen words, cut into learned pieces, in fewer tokens than bytes",
    (locale) => {
      const { corpus, sentence, merges, vocab } = run(locale);
      const seen = new Set(corpus.split(/[^\p{L}]+/u));
      const unseen = sentence.split(/[^\p{L}]+/u).filter((w) => w && !seen.has(w));
      expect(unseen.length).toBeGreaterThan(1);
      const ids = encode(sentence, merges);
      expect(ids.length).toBeLessThan(utf8(sentence).length);
      expect(ids.some((id) => id >= 256 && vocab[id].length > 2)).toBe(true);
    },
  );

  it("stops because no pair repeats, not at the cap, in both locales", () => {
    for (const locale of Object.keys(entry)) {
      const { merges, stop } = run(locale);
      expect(stop).toBe("min-freq");
      expect(merges.length).toBeLessThan(BPE_WIDGET_MAX_MERGES);
    }
  });

  // The numbers «BPE de verdad» reads off the Spanish explorable.
  it("gives the Spanish numbers the lesson quotes", () => {
    const { corpus, sentence, merges, spell } = run("es");
    expect(utf8(corpus)).toHaveLength(180);
    expect(merges).toHaveLength(31);
    expect(merges[0].freq).toBe(10);
    expect(spell(merges[0].id)).toBe("ñ");
    expect(spell(merges[4].id)).toBe("ó");
    expect(spell(merges[16].id)).toBe("ción");
    expect(encode(corpus, merges)).toHaveLength(80);
    expect(utf8(sentence)).toHaveLength(42);
    expect(encode(sentence, merges)).toHaveLength(22);
    // At step 0 the sentence's ñ is two byte tokens, C3 and B1.
    expect(encode(sentence, []).filter((b) => b === 0xc3 || b === 0xb1)).toHaveLength(6);
  });

  it("keeps the English naïve's ï as two bytes to the end — a letter the corpus lacks", () => {
    const { sentence, merges } = run("en");
    const ids = encode(sentence, merges);
    const i = ids.indexOf(0xc3);
    expect(ids.slice(i, i + 2)).toEqual([0xc3, 0xaf]);
  });
});

describe("widget corpora — chat-template keeps its teaching property", () => {
  const entry = WIDGET_CORPORA["chat-template"].byLocale;
  const merges = (
    JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public", "courses", "llm-agents", "bpe-merges.json"), "utf8"),
    ) as [number, number][]
  ).map((pair, i) => ({ pair, id: N_BYTES + i }) as const);
  const forge = (locale: string) => {
    const { messages, forged } = entry[locale];
    const u = messages.findIndex((m) => m.role === "usuario");
    return messages.map((m, i) => (i === u ? { ...m, content: m.content + forged } : m));
  };

  it("opens, in Spanish, on the conversation the lesson's cell prints: 41 tokens, 12 with loss", () => {
    const { tokens } = renderSpecial(entry.es.messages, merges);
    expect(tokens).toHaveLength(41);
    expect(tokens.filter((t) => t.response)).toHaveLength(12);
  });

  it.each(Object.keys(entry))("in %s the forged line reads back as one more assistant message", (locale) => {
    const { messages, markers } = entry[locale];
    const text = renderText(forge(locale), merges, markers);
    expect(text.readBack).toHaveLength(messages.length + 1);
    const u = messages.findIndex((m) => m.role === "usuario");
    expect(text.readBack[u + 1].role).toBe("asistente");
    // Its tokens carry loss although the user typed them.
    expect(text.tokens.some((t) => t.response && t.message === u + 1)).toBe(true);
  });

  it.each(Object.keys(entry))("in %s the special-token template is not fooled", (locale) => {
    const special = renderSpecial(forge(locale), merges);
    expect(special.readBack).toEqual(forge(locale));
    expect(special.tokens.filter((t) => t.response).every((t) => t.role === "asistente")).toBe(true);
  });

  it.each(Object.keys(entry))("in %s the honest conversation reads back as itself both ways", (locale) => {
    const { messages, markers } = entry[locale];
    expect(renderText(messages, merges, markers).readBack).toEqual(messages);
    expect(renderSpecial(messages, merges).readBack).toEqual(messages);
  });
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
