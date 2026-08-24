/*
 * COURSE-P5-00 — Tests for "a display equation carries its sentence's punctuation".
 *
 * Half of these assert SILENCE, and that is the point: the pass fires on one decidable
 * case and every other shape has to stay quiet, or authors learn to skip the report.
 */

import { mathPunctuationWarnings } from "../validate-math-punctuation";

/** A lesson body wrapped in the minimum frontmatter, so the line numbers in the
 *  warnings are file line numbers rather than body line numbers. */
function lesson(body: string): string {
  return `---\nslug: demo\n---\n\n${body}\n`;
}

const EQUATION = "s = (w_1, \\dots, w_T), \\qquad w_t \\in V";

function block(equation: string, after: string): string {
  return lesson(`Un texto es una secuencia:\n\n$$\n${equation}\n$$\n\n${after}`);
}

describe("mathPunctuationWarnings", () => {
  it("flags an unpunctuated block whose next paragraph starts a new sentence", () => {
    const warnings = mathPunctuationWarnings(block(EQUATION, "Una red, en cambio, es una función."));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/math punctuation/);
    expect(warnings[0]).toMatch(/w_t \\in V/);
  });

  it("names the line of the opening fence and the line that starts the sentence", () => {
    // 1 `---` · 2 slug · 3 `---` · 4 blank · 5 prose · 6 blank · 7 `$$` … 9 `$$` · 11 prose
    const [warning] = mathPunctuationWarnings(block(EQUATION, "Una red, en cambio."));
    expect(warning).toMatch(/line 7 /);
    expect(warning).toMatch(/line 11 /);
  });

  it("accepts a block that ends the sentence with a period", () => {
    expect(mathPunctuationWarnings(block(`${EQUATION}.`, "Una red, en cambio."))).toEqual([]);
  });

  it("accepts a comma before a clause that continues the sentence", () => {
    expect(
      mathPunctuationWarnings(block("f : \\mathbb{R}^d \\to \\mathbb{R}^k,", "donde $d$ es la dimensión.")),
    ).toEqual([]);
  });

  it("accepts an unpunctuated block the sentence runs straight through", () => {
    expect(
      mathPunctuationWarnings(block("r : V \\to \\mathbb{R}^d", "y con ella cada palabra es un vector.")),
    ).toEqual([]);
  });

  it("accepts a colon introducing what follows", () => {
    expect(mathPunctuationWarnings(block(`${EQUATION}:`, "Primero, el vocabulario."))).toEqual([]);
  });

  it("stays quiet when the next line is not prose", () => {
    for (const after of [
      "## Un eje para cada entrada",
      "<Details summary=\"Por qué\">\nTexto.\n</Details>",
      "| $\\tau$ | $T$ |\n|---|---|\n| caracteres | $C$ |",
      "- Primera cosa.",
      "**Totalidad.** $r$ tiene que estar definida.",
      "$\\lvert V \\rvert$ es el tamaño del vocabulario.",
      "{/* COURSE-P5-01 */}",
    ]) {
      expect(mathPunctuationWarnings(block(EQUATION, after))).toEqual([]);
    }
  });

  it("stays quiet when the block is the last thing in the file", () => {
    expect(mathPunctuationWarnings(lesson(`Y por tanto:\n\n$$\n${EQUATION}\n$$`))).toEqual([]);
  });

  it("ignores single-line `$$…$$`, which renders inline", () => {
    expect(mathPunctuationWarnings(lesson(`Vale $$${EQUATION}$$\n\nUna red, en cambio.`))).toEqual([]);
  });

  it("ignores `$$` inside a fenced code block", () => {
    const body = ["```bash", "$$", "echo $$", "$$", "```", "", "Una red, en cambio."].join("\n");
    expect(mathPunctuationWarnings(lesson(body))).toEqual([]);
  });

  it("ignores maths in the frontmatter", () => {
    const source = [
      "---",
      "slug: demo",
      "quiz:",
      "  - prompt: '$$\\sqrt{2}$$'",
      "---",
      "",
      "Texto.",
    ].join("\n");
    expect(mathPunctuationWarnings(source)).toEqual([]);
  });

  it("reports every offending block in one lesson", () => {
    const body = [
      "Primero:",
      "",
      "$$",
      "a = b",
      "$$",
      "",
      "Después, segundo:",
      "",
      "$$",
      "c = d",
      "$$",
      "",
      "Y ya está.",
    ].join("\n");
    expect(mathPunctuationWarnings(lesson(body))).toHaveLength(2);
  });

  it("reads the last line of a multi-line equation", () => {
    const cases = ["\\begin{cases}", "1 & \\text{si } j = i \\\\", "0 & \\text{si } j \\neq i", "\\end{cases}"];
    expect(mathPunctuationWarnings(block(cases.join("\n"), "Es una $r$ como la que pedía."))).toHaveLength(1);
    expect(
      mathPunctuationWarnings(block([...cases.slice(0, -1), "\\end{cases}."].join("\n"), "Es una $r$.")),
    ).toEqual([]);
  });

  it("flags a question opening with ¿ as a new sentence", () => {
    expect(mathPunctuationWarnings(block(EQUATION, "¿Cuántas entradas caben?"))).toHaveLength(1);
  });

  it("flags an accented capital as a new sentence", () => {
    expect(mathPunctuationWarnings(block(EQUATION, "Éste es el punto."))).toHaveLength(1);
  });
});
