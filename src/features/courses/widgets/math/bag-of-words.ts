/*
 * COURSE-P5-01 — Pure bag-of-words construction for the `bag-of-words` explorable.
 *
 * Block 1 lesson 5 derives x_d = Σ_t o_{w_t}: the document vector is the SUM of the
 * one-hot vectors of its tokens. This module produces exactly that, one row per token
 * plus the summed row, so the widget can show the derivation rather than assert it.
 *
 * Two decisions worth stating.
 *
 * Tokenisation is `tokenizeWords` from ./tokenisation, reused verbatim — same cut, same
 * NFC normalisation, same treatment of punctuation as its own token as the lesson's code
 * cell. A second tokeniser here would be a second answer to "what are the entries of V?"
 * in the one block whose subject is that question. Note it does NOT lower-case: Block 1
 * lesson 2 rules that out for a tokeniser ("cortar, no limpiar"), so <W>El</W> and
 * <W>el</W> are two entries, exactly as in the lesson's Python.
 *
 * The token cap is per document and applied BEFORE the vocabulary is built, which is what
 * keeps the table honest. Capping the vocabulary instead would leave a token whose column
 * is not displayed, and its one-hot row would render as all zeros — a picture that
 * contradicts the very equation the widget exists to show.
 */

import { tokenizeWords } from "./tokenisation";

/*
 * Tokens shown per document. This also bounds the table, which is at most
 * 2 × MAX_TOKENS_PER_DOC columns wide. It exists to stop a pasted paragraph from
 * producing an unreadable matrix, NOT to trim the lesson's own examples — both of them
 * must fit with room to spare, or the widget silently drops words the prose talks about.
 * The longer default is 14 tokens.
 */
export const MAX_TOKENS_PER_DOC = 20;

export interface DocumentBag {
  /** The tokens actually displayed (capped at `maxTokens`). */
  tokens: string[];
  /** One row per token: its one-hot vector over `vocab`. */
  rows: number[][];
  /** Column sums of `rows` — the bag-of-words vector of this document. */
  sum: number[];
  /** Did the cap drop tokens off the end? */
  truncated: boolean;
}

export interface BagOfWordsModel {
  /** Vocabulary entries in order of first appearance across the documents. */
  vocab: string[];
  documents: DocumentBag[];
  /**
   * Occurrences of each entry across the WHOLE corpus — the column sums of every
   * document vector added together. This is the corpus-level view the per-document sums
   * cannot give: an entry is uninformative because it is everywhere, and "everywhere" is
   * a property of the corpus, not of one document. It is also the quantity the lesson
   * turns into df(t) two sections later.
   */
  total: number[];
}

/**
 * Build the vocabulary shared by `texts` and, for each of them, the one-hot row per
 * token and their sum. Pure — no DOM, no state.
 */
export function buildBagOfWords(
  texts: string[],
  maxTokens: number = MAX_TOKENS_PER_DOC,
): BagOfWordsModel {
  const cut = texts.map((text) => {
    const all = tokenizeWords(text);
    return { tokens: all.slice(0, maxTokens), truncated: all.length > maxTokens };
  });

  // First appearance across all documents, in reading order — so the columns run in the
  // order the student meets the words, and the entry/column correspondence is visible.
  const position = new Map<string, number>();
  const vocab: string[] = [];
  for (const doc of cut) {
    for (const token of doc.tokens) {
      if (position.has(token)) continue;
      position.set(token, vocab.length);
      vocab.push(token);
    }
  }

  const documents = cut.map(({ tokens, truncated }) => {
    const rows = tokens.map((token) => {
      const row = new Array<number>(vocab.length).fill(0);
      row[position.get(token) as number] = 1;
      return row;
    });
    const sum = vocab.map((_, i) => rows.reduce((total, row) => total + row[i], 0));
    return { tokens, rows, sum, truncated };
  });

  const total = vocab.map((_, i) =>
    documents.reduce((running, doc) => running + doc.sum[i], 0),
  );

  return { vocab, documents, total };
}
