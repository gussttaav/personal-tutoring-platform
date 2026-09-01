/*
 * COURSE-P5-00 — Tests for the banned-word families in docs/courses/AUTHORING.md §5.
 *
 * The case that motivated this module is the last test in the first block: `sencillamente`
 * shipped in Block 1 lesson 1 and survived review, because the guide had listed
 * `simplemente` and a reviewer reads what the guide says. The ban is on the family.
 */

import { voiceWarnings } from "../validate-voice";

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
