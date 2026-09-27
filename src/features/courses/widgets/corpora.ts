/*
 * COURSE-P11-02 — Per-locale default corpora for the explorables.
 *
 * A widget's interface text is translation (see `messages/*.json`, namespace
 * `courses.widgets.*`). Its DEFAULT CORPUS is not: the sentences below were chosen so
 * that the widget demonstrates the thing the prose says it demonstrates, and a literal
 * translation of one of them keeps the widget running while quietly switching the
 * demonstration off. So they live here, as data, one entry per widget id, with the
 * teaching property written down next to each one — the choice is reviewable in one
 * file instead of buried in fifteen components.
 *
 * Choosing a corpus is a PEDAGOGICAL decision and it belongs to whoever writes the
 * lesson that embeds the widget. `property` is the contract that decision has to meet,
 * and it is verified by looking at the rendered widget, never by reading the sentence.
 *
 * `es` is required and is what an unknown locale falls back to, mirroring
 * `routing.defaultLocale`. Spanish entries are frozen: the lessons quote the words the
 * widget shows (`niño`, `##`, `el`), so moving one silently contradicts published prose.
 */

import { routing } from "@/i18n/routing";

export interface WidgetCorpus<T> {
  /** What the corpus has to make visible. Every locale's entry must satisfy it. */
  readonly property: string;
  /** Per-locale corpus. `es` is required — see the header. */
  readonly byLocale: { readonly es: T } & Readonly<Record<string, T>>;
}

/**
 * Widget id → locale → corpus. Only the widgets whose default data is locale-sensitive
 * appear here; the numeric demos (`sigmoid-explorer`, `gradient-descent-2d`,
 * `positional-encoding`, …) have no corpus at all, and the ones listed in
 * `SPANISH_BOUND_CORPORA` have one that cannot move yet.
 */
export const WIDGET_CORPORA: {
  readonly "tokenizer-playground": WidgetCorpus<string>;
  readonly "bag-of-words": WidgetCorpus<readonly string[]>;
  readonly "bpe-merges": WidgetCorpus<{ readonly corpus: string; readonly sentence: string }>;
} = {
  /*
   * Three tokenisers, three visibly different answers. The Spanish default earns that
   * three ways at once: `niño` is the NFC point (one code point, not `n` + a combining
   * tilde), `programación` breaks into subwords through the `ción` merge, and the
   * word/character counts are 7 against 39.
   *
   * The English default is chosen against the SAME property, not translated from it:
   * `naïve` carries the NFC point, `tokenisation` is the long morphological word that
   * BPE breaks up (`to ##ke ##n ##is ##a ##t ##i ##on`), and the counts are 8 against
   * 48. Verified by running the three tokenisers — see the corpora test.
   */
  "tokenizer-playground": {
    property:
      "The three tokenisers visibly disagree; at least one word splits into several " +
      "subword pieces; one character exercises NFC normalisation.",
    byLocale: {
      es: "El niño enseña programación en español.",
      en: "The naïve teacher tests tokenisation in English.",
    },
  },

  /*
   * Two documents on unrelated topics, each dominated by ONE article repeated four
   * times, sharing their function words with each other. That makes both readings
   * visible at once: per document the biggest coordinate is the entry that says least
   * about it (4, against 1 for every content word), and the corpus row is topped by
   * function words alone — which is the observation TF-IDF corrects.
   *
   * Spanish: el=4 in doc 1, la=4 in doc 2; corpus el=5, la=4, de=2, y=2.
   * English has one definite article, so both documents lean on `the` (4 each, 8 in
   * the corpus) and share `of` and `and` at 2 apiece. Same shape, same reading: every
   * content word still sits at 1. Both fit `MAX_TOKENS_PER_DOC` with room to spare.
   */
  "bag-of-words": {
    property:
      "Two documents, each dominated by one function word repeated four times and " +
      "sharing function words with the other; every content word occurs exactly once, " +
      "so the corpus row is topped by the words that say least.",
    byLocale: {
      es: [
        "el portero paró el balón de penalti y el equipo ganó el partido",
        "la receta lleva la harina y la mantequilla de la abuela en el horno",
      ],
      en: [
        "the keeper saved the penalty of the season and the team won",
        "the recipe needs the flour and the butter of the grandmother",
      ],
    },
  },

  /*
   * COURSE-C2-P1-01 — `bpe-merges` (llm-agents Block 1 lesson 2). A corpus small enough
   * to read whole, and a sentence the corpus does not contain. The lesson quotes what
   * happens on the Spanish pair, so the numbers are frozen and asserted in
   * corpora.test.ts: 180 bytes and 31 merges that repeat; merge 1 is `C3`+`B1` → `ñ`
   * (f = 10, ñ being the most frequent pair of all, which is what ten ñ with varied
   * neighbours buys); merge 5 is `ó`, because the `-ó` verbs give `C3 B3` more
   * occurrences than any pair that would split it; merge 17 closes `ci` + `ón` → `ción`.
   * The sentence goes from 42 bytes to 22 tokens, and its unseen words (`pequeña`,
   * `enseñó`, `cuna`) end cut into pieces the corpus taught.
   *
   * English, against the same property rather than translated: merge 1 is `C3`+`A9` →
   * `é` (café, José, fiancé…), `tion` is built by merge 4, and the sentence's `naïve`
   * carries a letter the corpus never had, which stays two bytes to the end — the case
   * the Spanish sentence does not show, and byte-level BPE's whole answer to OOV.
   */
  "bpe-merges": {
    property:
      "Merge 1 fuses the two UTF-8 bytes of one accented letter into a single token; a " +
      "suffix (-ción / -tion) is built by later merges; the sentence contains words the " +
      "corpus does not, which end cut into learned pieces, and drops to fewer tokens than " +
      "bytes.",
    byLocale: {
      es: {
        corpus:
          "El año pasado, la niña y el niño cantaron una canción en la montaña. Cada " +
          "mañana, el señor enseña una lección. La niña sueña con otra canción; el niño " +
          "bailó y cantó.",
        sentence: "La pequeña enseñó una canción de cuna.",
      },
      en: {
        corpus:
          "José runs a café by the station. At the café, the fiancé orders an entrée and " +
          "José mentions the nation's tradition. The café's résumé: one station, one " +
          "question.",
        sentence: "The naïve fiancée asked José a question at the station.",
      },
    },
  },
};

export type CorpusWidgetId = keyof typeof WIDGET_CORPORA;

/**
 * Widgets whose default data is locale-sensitive and CANNOT be moved by a translation
 * task: their corpus is bound to a Spanish data asset, and an English sentence would
 * render a map that means nothing rather than a map that reads oddly. Each one needs a
 * new asset and a pedagogical decision, which belongs to the lesson that embeds it.
 *
 * COURSE-C2-P0-03: a key with a `/` in it is not a widget id but a course asset under
 * `public/` — the same kind of Spanish-bound data, consumed by `<PyCell>`s and by the
 * widgets that read it, rather than by one widget's default corpus.
 */
export const SPANISH_BOUND_CORPORA: Readonly<Record<string, string>> = {
  "self-attention-heatmap":
    "The presets are scored against the hand-built Spanish lexicon in " +
    "math/self-attention.ts (determiner/noun/verb features, number agreement). An " +
    "English sentence falls outside it, so every token takes its vector from a hash " +
    "of its own letters and the map says nothing. Needs an English lexicon first.",
  "multi-head-view":
    "Same lexicon as self-attention-heatmap, and the four heads ARE its four rules.",
  // embedding-projection was here until COURSE-P11-04: it now has an English scatter,
  // public/courses/dl-nlp/embeddings-sample.en.json, picked per locale by the widget.
  "attention-alignment":
    "Not locale-sensitive at all, listed here so the review is complete: the corpus is " +
    "a Spanish→English translation pair, which is what Block 4 is about. It reads the " +
    "same way to either audience.",
  // COURSE-C2-P1-01 — llm-agents Block 1 lesson 4.
  "sampling-explorer":
    "Its two logit vectors (math/sampling-presets.ts) are the mini-GPT checkpoint's own " +
    "output on two Spanish contexts, «La Nela» and «La Nela bajó la cabe», and the lesson " +
    "quotes them. An English context means the English checkpoint, then re-running " +
    "scripts/courses/llm-agents/sampling-presets.py on a pair chosen for the same " +
    "property: one context where the model hesitates between dozens of entries, one where " +
    "a single entry holds nearly all the mass.",
  // COURSE-C2-P0-03 — the llm-agents mini-GPT is trained on this Spanish corpus, and
  // its checkpoint (minigpt.json) and merge table (bpe-merges.json) are functions of it.
  "courses/llm-agents/corpus.txt":
    "Marianela (Galdós, public domain), the corpus the llm-agents Block 1 mini-GPT is " +
    "trained on. Every text the checkpoint generates, every merge in bpe-merges.json and " +
    "every number the Block 1–3 lessons quote is a function of it. The English course " +
    "needs an English corpus AND its own checkpoint, re-trained by " +
    "scripts/courses/llm-agents/train-minigpt.py (corpus path and output directory are " +
    "its parameters) — plus new lesson prose, since the quoted samples change with it.",
};

/**
 * The corpus this locale should get, falling back to `es` for any locale with no entry
 * — the same default the routing config declares.
 */
export function widgetCorpus<K extends CorpusWidgetId>(
  id: K,
  locale: string,
): (typeof WIDGET_CORPORA)[K]["byLocale"]["es"] {
  const { byLocale } = WIDGET_CORPORA[id];
  return byLocale[locale] ?? byLocale[routing.defaultLocale];
}
