/*
 * COURSE-P5-00 — Tests for the banned-word families in docs/courses/AUTHORING.md §5.
 *
 * The case that motivated this module is the last test in the first block: `sencillamente`
 * shipped in Block 1 lesson 1 and survived review, because the guide had listed
 * `simplemente` and a reviewer reads what the guide says. The ban is on the family.
 *
 * COURSE-P11-01 — the same two families in English, selected by the lesson's locale. The
 * test that matters most is the cross-firing pair at the bottom: before this task an
 * English lesson was scanned against the Spanish list, which is the same as not being
 * scanned at all, and the pass reported a clean file.
 */

import { lessonLocale, voiceWarnings } from "../validate-voice";

function lesson(body: string, frontmatter = "slug: demo"): string {
  return `---\n${frontmatter}\n---\n\n${body}\n`;
}

describe("voiceWarnings — condescension", () => {
  it("flags each member of the family", () => {
    for (const word of [
      "obviamente",
      "evidentemente",
      "claramente",
      "simplemente",
      "sencillamente",
      "trivialmente",
    ]) {
      const warnings = voiceWarnings(lesson(`Esto ${word} se deduce de lo anterior.`));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(word);
      expect(warnings[0]).toMatch(/condescension/);
    }
  });

  it("flags the phrases that are the same move wearing a hat", () => {
    for (const phrase of [
      "basta con derivar",
      "bastaría con derivar",
      "no es más que una suma",
      "no son más que sumas",
      "por supuesto que converge",
      "se sigue sin más",
    ]) {
      expect(voiceWarnings(lesson(`El resultado ${phrase}.`))).toHaveLength(1);
    }
  });

  it("reports one warning however many times the word appears", () => {
    const body = "Simplemente esto.\n\nY simplemente lo otro.\n\nSimplemente aquello.";
    expect(voiceWarnings(lesson(body))).toHaveLength(1);
  });

  it("reports each distinct offender separately", () => {
    expect(voiceWarnings(lesson("Obviamente basta con derivarlo."))).toHaveLength(2);
  });
});

describe("voiceWarnings — padding", () => {
  it("flags the phrases that narrate the lesson instead of writing it", () => {
    for (const phrase of [
      "Cabe destacar que",
      "Es importante señalar que",
      "Como podemos observar,",
      "Como puedes ver,",
      "A continuación veremos",
      "En esta sección vamos a ver",
      "En el presente apartado",
    ]) {
      const warnings = voiceWarnings(lesson(`${phrase} el vocabulario crece.`));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/padding/);
    }
  });
});

describe("voiceWarnings — what it must not fire on", () => {
  it("stays quiet on the prose the course actually ships", () => {
    const body = [
      "Una red neuronal no puede recibir directamente la palabra <W>hola</W>.",
      "",
      "Fijemos el vocabulario y llamémoslo $V$. Toma la frase <W>el gato bebe leche</W>",
      "y compruébalo tú mismo: la representación no es **estable**.",
    ].join("\n");
    expect(voiceWarnings(lesson(body))).toEqual([]);
  });

  it("does not fire on a longer word that merely contains a banned one", () => {
    // `sin más` vs `sin masa`, `basta con` vs `bastante contexto` — the word boundary has
    // to understand accented Spanish, which `\b` (built on [A-Za-z0-9_]) does not.
    expect(voiceWarnings(lesson("Un token sin masa no significa nada."))).toEqual([]);
    expect(voiceWarnings(lesson("Hay bastante contexto en la ventana."))).toEqual([]);
    expect(voiceWarnings(lesson("Es un problema no resuelto."))).toEqual([]);
  });

  it("ignores a banned word inside a code fence", () => {
    const body = "```python\n# simplemente sumamos\nprint(1)\n```\n\nTexto normal.";
    expect(voiceWarnings(lesson(body))).toEqual([]);
  });

  it("ignores a banned word inside a <PyCell> template literal", () => {
    const body = "<PyCell code={`\n# obviamente, esto es un comentario\nprint(1)\n`} />";
    expect(voiceWarnings(lesson(body))).toEqual([]);
  });

  it("ignores anything inside an MDX comment — that is a note to the author", () => {
    expect(voiceWarnings(lesson("{/* obviamente hay que reescribir esto */}"))).toEqual([]);
  });
});

describe("voiceWarnings — frontmatter", () => {
  it("scans quiz prose, which the student reads like any other", () => {
    const frontmatter = [
      "slug: demo",
      "quiz:",
      "  - id: q1",
      "    explanation: 'Simplemente se sigue de la definición.'",
    ].join("\n");
    const warnings = voiceWarnings(lesson("Texto.", frontmatter));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/simplemente/);
  });

  it("does not read LaTeX in a prompt as prose", () => {
    const frontmatter = ["slug: demo", "quiz:", "  - id: q1", "    prompt: '¿Cuánto vale $x$?'"].join(
      "\n",
    );
    expect(voiceWarnings(lesson("Texto.", frontmatter))).toEqual([]);
  });
});

describe("voiceWarnings — accents", () => {
  it("matches a decomposed «señalar» as well as a composed one", () => {
    const composed = "Cabe señalar que el vocabulario crece.".normalize("NFC");
    const decomposed = composed.normalize("NFD");
    expect(voiceWarnings(lesson(composed))).toHaveLength(1);
    expect(voiceWarnings(lesson(decomposed))).toHaveLength(1);
  });
});

// ─── COURSE-P11-01 — the English families ─────────────────────────────────────

describe("voiceWarnings (en) — condescension", () => {
  it("flags each member of the family", () => {
    for (const word of [
      "obviously",
      "evidently",
      "clearly",
      "plainly",
      "simply",
      "merely",
      "trivially",
    ]) {
      const warnings = voiceWarnings(lesson(`This ${word} follows from the definition.`), "en");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(word);
      expect(warnings[0]).toMatch(/condescension/);
    }
  });

  it("flags the phrases that are the same move wearing a hat", () => {
    for (const phrase of [
      "of course it converges",
      "needless to say it converges",
      "all you have to do is differentiate it",
      "all you need to do is differentiate it",
      "it should be clear by now",
      "it should be obvious by now",
    ]) {
      expect(voiceWarnings(lesson(`The result — ${phrase}.`), "en")).toHaveLength(1);
    }
  });

  it("flags `is nothing more than`, the English «no es más que»", () => {
    const warnings = voiceWarnings(lesson("A neuron is nothing more than a dot product."), "en");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/condescension/);
  });

  it("flags bare `just`, the sibling `simply` alone would miss", () => {
    const warnings = voiceWarnings(lesson("You just need the gradient."), "en");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/just/);
  });

  it("reports one warning however many times the word appears", () => {
    const body = "Simply this.\n\nAnd simply that.\n\nSimply the other.";
    expect(voiceWarnings(lesson(body), "en")).toHaveLength(1);
  });
});

describe("voiceWarnings (en) — padding", () => {
  it("flags the phrases that narrate the lesson instead of writing it", () => {
    for (const phrase of [
      "It is worth noting that",
      "It's worth mentioning that",
      "It is important to note that",
      "As we can see,",
      "As you can observe,",
      "Note that",
      "In this section we will show that",
      "Let us now show that",
      "We will now show that",
    ]) {
      const warnings = voiceWarnings(lesson(`${phrase} the vocabulary grows.`), "en");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/padding/);
    }
  });

  it("leaves `it is important to <verb>` alone when the verb is the lesson", () => {
    // Verb-constrained like its Spanish counterpart: the padding is the self-narration,
    // not the words "it is important to".
    expect(voiceWarnings(lesson("It is important to normalise before comparing."), "en")).toEqual(
      [],
    );
  });
});

describe("voiceWarnings (en) — what it must not fire on", () => {
  it("stays quiet on ordinary English lesson prose", () => {
    const body = [
      "A neural network cannot take the word <W>hello</W> directly.",
      "",
      "Fix the vocabulary and call it $V$. Take the sentence <W>the cat drinks milk</W>",
      "and check for yourself: the representation is not **stable**.",
    ].join("\n");
    expect(voiceWarnings(lesson(body), "en")).toEqual([]);
  });

  it("does not fire on a longer word that merely contains a banned one", () => {
    // `just` inside `adjust`/`justify`, `merely` inside nothing — the boundaries are the
    // `\p{L}\p{N}` pair, unchanged from the Spanish rules and still correct here.
    expect(voiceWarnings(lesson("We adjust the weights each step."), "en")).toEqual([]);
    expect(voiceWarnings(lesson("The choice is hard to justify."), "en")).toEqual([]);
    expect(voiceWarnings(lesson("A clearing in the corpus."), "en")).toEqual([]);
  });

  it("keeps working on the accented words an English lesson quotes", () => {
    expect(voiceWarnings(lesson("The tokeniser splits <W>naïve</W> and <W>café</W>."), "en")).toEqual(
      [],
    );
  });

  it("ignores a banned word inside a code fence", () => {
    const body = "```python\n# simply add them\nprint(1)\n```\n\nOrdinary text.";
    expect(voiceWarnings(lesson(body), "en")).toEqual([]);
  });

  it("scans English quiz prose, which the student reads like any other", () => {
    const frontmatter = [
      "slug: demo",
      "quiz:",
      "  - id: q1",
      "    explanation: 'It simply follows from the definition.'",
    ].join("\n");
    const warnings = voiceWarnings(lesson("Text.", frontmatter), "en");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/simply/);
  });
});

describe("voiceWarnings — the families do not cross-fire", () => {
  it("says nothing about English prose when the lesson is Spanish", () => {
    // Not a hypothetical: this is what `en/` got before P11-01, because the walk recurses
    // the whole content root and only the Spanish list existed.
    expect(voiceWarnings(lesson("You simply add the bias."), "es")).toEqual([]);
  });

  it("says nothing about Spanish prose when the lesson is English", () => {
    expect(voiceWarnings(lesson("Simplemente sumamos el sesgo."), "en")).toEqual([]);
  });

  it("still warns on each in its own tree", () => {
    expect(voiceWarnings(lesson("You simply add the bias."), "en")).toHaveLength(1);
    expect(voiceWarnings(lesson("Simplemente sumamos el sesgo."), "es")).toHaveLength(1);
  });

  it("defaults to the canonical locale, so every pre-existing caller is unchanged", () => {
    expect(voiceWarnings(lesson("Simplemente sumamos el sesgo."))).toHaveLength(1);
  });

  it("checks a locale with no families declared against nothing", () => {
    expect(voiceWarnings(lesson("Simplemente. Simply."), "fr")).toEqual([]);
  });
});

describe("lessonLocale", () => {
  it("reads the locale off the lesson's directory", () => {
    expect(lessonLocale("/content/courses/dl-nlp/en/01-intro.mdx")).toBe("en");
    expect(lessonLocale("/content/courses/dl-nlp/es/01-intro.mdx")).toBe("es");
  });
});
