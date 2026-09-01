/*
 * COURSE-P8-01 — the three house rules `ReadingItemSchema` cannot express.
 *
 * Shape (kinds, the cap, note length, https, duplicate urls) is the schema's job and is
 * covered in `schemas.test.ts`; everything here is about links that are wrong in a way
 * only a click would reveal.
 */

import { frontmatterReading, readingProblems } from "../validate-reading";

/** A lesson source with the given `reading:` YAML spliced into its frontmatter. */
function lesson(readingYaml: string): string {
  return `---
slug: demo
title: "Demo"
block: 1
order: 1
minutes: 20
summary: "Demo"
draft: true
hasCode: false
hasQuiz: false
quiz: []
challenges: []
${readingYaml}
---

Cuerpo.
`;
}

const ABS = `reading:
  - kind: paper
    title: 'Efficient Estimation of Word Representations in Vector Space'
    authors: 'Mikolov et al.'
    year: '2013'
    venue: 'arXiv:1301.3781'
    lang: en
    url: 'https://arxiv.org/abs/1301.3781'
    note: 'Skip-gram y CBOW.'`;

describe("frontmatterReading", () => {
  it("returns the declared entries", () => {
    expect(frontmatterReading(lesson(ABS))).toHaveLength(1);
  });

  it("returns [] when the lesson declares none", () => {
    expect(frontmatterReading(lesson("reading: []"))).toEqual([]);
  });

  it("returns [] when `reading` is absent entirely", () => {
    const source = lesson("reading: []").replace("reading: []\n", "");
    expect(frontmatterReading(source)).toEqual([]);
  });
});

describe("readingProblems", () => {
  it("accepts a well-formed arXiv abstract link", () => {
    expect(readingProblems(lesson(ABS))).toEqual([]);
  });

  it("accepts a lesson with no reading at all", () => {
    expect(readingProblems(lesson("reading: []"))).toEqual([]);
  });

  it("rejects an arXiv PDF link", () => {
    const problems = readingProblems(lesson(ABS.replace("/abs/", "/pdf/")));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/arXiv PDF/);
    expect(problems[0]).toMatch(/\/abs\//);
  });

  it("rejects a venue whose arXiv id disagrees with the url", () => {
    const problems = readingProblems(lesson(ABS.replace("arXiv:1301.3781", "arXiv:1310.4546")));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/stale/);
  });

  it("ignores the version suffix when comparing arXiv ids", () => {
    const versioned = ABS.replace("/abs/1301.3781", "/abs/1301.3781v3");
    expect(readingProblems(lesson(versioned))).toEqual([]);
  });

  it("rejects the same title listed twice under different urls", () => {
    const twice = `${ABS}
  - kind: paper
    title: 'Efficient Estimation of Word Representations in Vector Space'
    authors: 'Mikolov et al.'
    year: '2013'
    venue: 'doi'
    lang: en
    url: 'https://doi.org/10.48550/arXiv.1301.3781'
    note: 'La misma cosa otra vez.'`;
    const problems = readingProblems(lesson(twice));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/listed twice/);
  });

  it("leaves non-arXiv links alone", () => {
    const book = `reading:
  - kind: libro
    title: 'Speech and Language Processing'
    authors: 'Jurafsky y Martin'
    venue: 'stanford.edu'
    lang: en
    url: 'https://web.stanford.edu/~jurafsky/slp3/'
    note: 'El libro de referencia.'`;
    expect(readingProblems(lesson(book))).toEqual([]);
  });
});
