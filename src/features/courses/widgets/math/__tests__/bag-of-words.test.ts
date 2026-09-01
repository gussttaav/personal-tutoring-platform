/*
 * COURSE-P5-01 — bag-of-words tests.
 *
 * The properties asserted here are the ones Block 1 lesson 5 derives in prose, so a
 * regression would make the widget contradict the lesson: every token row is one-hot,
 * the sum row counts occurrences, and the sum does not depend on word order.
 *
 * Accented characters are built with `String.fromCharCode` (pure-ASCII source), matching
 * ./tokenisation.test.ts, so no assertion depends on this file's encoding on disk.
 */

import { buildBagOfWords, MAX_TOKENS_PER_DOC } from "../bag-of-words";

const N_TILDE = String.fromCharCode(0x00f1); // ñ
const COMB_TILDE = String.fromCharCode(0x0303);
const N_TILDE_NFD = "n" + COMB_TILDE; // decomposed ñ

describe("buildBagOfWords", () => {
  it("collects the vocabulary in order of first appearance, without repeats", () => {
    const { vocab } = buildBagOfWords(["la casa de la playa", "el gato de la casa"]);
    expect(vocab).toEqual(["la", "casa", "de", "playa", "el", "gato"]);
  });

  it("gives every token a one-hot row over that vocabulary", () => {
    const { vocab, documents } = buildBagOfWords(["la casa de la playa", ""]);
    const [doc] = documents;

    expect(doc.rows).toHaveLength(doc.tokens.length);
    for (const row of doc.rows) {
      expect(row).toHaveLength(vocab.length);
      expect(row.filter((v) => v === 1)).toHaveLength(1);
      expect(row.every((v) => v === 0 || v === 1)).toBe(true);
    }

    // The 1 sits in the column of that token.
    doc.rows.forEach((row, i) => {
      expect(vocab[row.indexOf(1)]).toBe(doc.tokens[i]);
    });
  });

  it("sums the one-hot rows into occurrence counts", () => {
    const { vocab, documents } = buildBagOfWords(["la casa de la playa", ""]);
    const [doc] = documents;

    expect(doc.sum[vocab.indexOf("la")]).toBe(2);
    expect(doc.sum[vocab.indexOf("casa")]).toBe(1);
    // Every coordinate is the column sum of the rows above it.
    vocab.forEach((_, i) => {
      expect(doc.sum[i]).toBe(doc.rows.reduce((total, row) => total + row[i], 0));
    });
    // And the coordinates add up to the number of tokens.
    expect(doc.sum.reduce((a, b) => a + b, 0)).toBe(doc.tokens.length);
  });

  it("gives the same sum whatever the word order — this is the bag", () => {
    const { documents } = buildBagOfWords([
      "el perro muerde al " + N_TILDE_NFD + "o",
      "el " + N_TILDE_NFD + "o muerde al perro",
    ]);
    expect(documents[0].sum).toEqual(documents[1].sum);
    // …while the rows, which keep the positions, differ.
    expect(documents[0].rows).not.toEqual(documents[1].rows);
  });

  it("normalises to NFC, so a decomposed enye is the same entry as a composed one", () => {
    const { vocab } = buildBagOfWords(["ni" + N_TILDE_NFD + "o", "ni" + N_TILDE + "o"]);
    expect(vocab).toEqual(["ni" + N_TILDE + "o"]);
  });

  it("caps tokens per document and flags it, building the vocabulary from what is shown", () => {
    const long = Array.from({ length: MAX_TOKENS_PER_DOC + 5 }, (_, i) => "p" + i).join(" ");
    const { vocab, documents } = buildBagOfWords([long, "otra cosa"], MAX_TOKENS_PER_DOC);

    expect(documents[0].truncated).toBe(true);
    expect(documents[0].tokens).toHaveLength(MAX_TOKENS_PER_DOC);
    expect(documents[1].truncated).toBe(false);
    // Nothing beyond the cap leaks into the columns, so no row can be all zeros.
    expect(vocab).not.toContain("p" + MAX_TOKENS_PER_DOC);
    for (const doc of documents) {
      for (const row of doc.rows) expect(row).toContain(1);
    }
  });

  it("handles an empty document without producing rows", () => {
    const { documents } = buildBagOfWords(["", "hola"]);
    expect(documents[0].tokens).toEqual([]);
    expect(documents[0].rows).toEqual([]);
    expect(documents[0].sum).toEqual([0]);
    expect(documents[0].truncated).toBe(false);
  });

  it("totals the corpus by adding the document vectors coordinate by coordinate", () => {
    const { vocab, documents, total } = buildBagOfWords([
      "el gato de el tejado",
      "la casa de la playa",
    ]);

    expect(total).toHaveLength(vocab.length);
    vocab.forEach((_, i) => {
      expect(total[i]).toBe(documents.reduce((running, doc) => running + doc.sum[i], 0));
    });

    // An entry repeated inside one document, and one shared across both.
    expect(total[vocab.indexOf("el")]).toBe(2);
    expect(total[vocab.indexOf("de")]).toBe(2);
    expect(total[vocab.indexOf("gato")]).toBe(1);
    // And the corpus total is every token of every document.
    expect(total.reduce((a, b) => a + b, 0)).toBe(
      documents.reduce((n, doc) => n + doc.tokens.length, 0),
    );
  });
});
