/*
 * COURSE-P5-00 — Tests for the "don't ship the scaffolding" rule.
 *
 * The six-step structure is an authoring tool. Rendered as literal headings it becomes a
 * reader interface, and a bad one. This check is the machine-checkable half of that rule:
 * a heading may not be named after a step.
 *
 * COURSE-P5-00 — + the bridge's `---`. `lesson()` therefore ends every fixture on a
 * well-formed bridge, so a test about headings measures only headings; the bridge rules
 * get their own describe block, where the fixtures are built by hand.
 */

import { bridgeWarnings, structureWarnings } from "../validate-structure";

const BRIDGE = "---\n\nY esto abre la lección siguiente.";

function lesson(body: string): string {
  return `---\nslug: demo\n---\n\n${body}\n\n${BRIDGE}\n`;
}

function raw(body: string): string {
  return `---\nslug: demo\n---\n\n${body}\n`;
}

describe("structureWarnings", () => {
  it("flags a heading named after a step", () => {
    const warnings = structureWarnings(lesson("## Motivación\n\nTexto."));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Motivación/);
    expect(warnings[0]).toMatch(/step name/);
  });

  it("flags every step name, accents and case notwithstanding", () => {
    for (const heading of [
      "## Motivación",
      "## intuicion",
      "## FORMALIZACIÓN",
      "## Implementación",
      "## Implementación a mano",
      "## Verificación",
      "## Puente",
    ]) {
      expect(structureWarnings(lesson(`${heading}\n\nTexto.`))).toHaveLength(1);
    }
  });

  it("flags a step name with trailing punctuation", () => {
    expect(structureWarnings(lesson("## Puente:\n\nTexto."))).toHaveLength(1);
  });

  it("flags an `###` step heading too", () => {
    expect(structureWarnings(lesson("### Verificación\n\nTexto."))).toHaveLength(1);
  });

  it("accepts headings that describe what the lesson actually does", () => {
    const body = [
      "## Qué exige exactamente una red neuronal",
      "",
      "### La representación que parece funcionar y no funciona",
      "",
      "## Construyendo la matriz one-hot en NumPy",
      "",
      "## Comprueba tu intuición",
    ].join("\n");
    expect(structureWarnings(lesson(body))).toEqual([]);
  });

  it("does not flag a step name used in prose — only headings", () => {
    expect(structureWarnings(lesson("La **motivación** de esta lección es otra."))).toEqual([]);
  });

  it("does not flag a step name inside a code fence", () => {
    expect(structureWarnings(lesson("```md\n## Motivación\n```"))).toEqual([]);
  });

  it("says nothing about a lesson with no headings at all", () => {
    expect(structureWarnings(lesson("Sólo prosa, de principio a fin."))).toEqual([]);
  });

  it("reports one warning per offending heading", () => {
    const body = "## Motivación\n\nTexto.\n\n## Puente\n\nTexto.";
    expect(structureWarnings(lesson(body))).toHaveLength(2);
  });

  it("carries the bridge check too — one entry point for the lint", () => {
    expect(structureWarnings(raw("Sólo prosa, sin puente."))[0]).toMatch(/no `---`/);
  });
});

/*
 * The bridge is the step whose absence is invisible in the source: with no `---` the
 * closing paragraphs still read fine on their own and simply attach themselves to the
 * section above. These are the three ways that goes wrong.
 */
describe("bridgeWarnings", () => {
  it("accepts a lesson whose bridge is marked and closes the file", () => {
    expect(bridgeWarnings(lesson("## Comprueba tu intuición\n\nTexto."))).toEqual([]);
  });

  it("flags a lesson with no thematic break", () => {
    const warnings = bridgeWarnings(raw("## Comprueba tu intuición\n\nTexto.\n\nY el puente."));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/no `---` before the bridge/);
  });

  it("flags a second thematic break — `---` is reserved for the bridge", () => {
    const body = "Texto.\n\n---\n\nMás texto.\n\n---\n\nEl puente.";
    const warnings = bridgeWarnings(raw(body));
    expect(warnings.some((w) => /2 thematic breaks/.test(w))).toBe(true);
  });

  it("flags a `---` with no blank line above it — markdown reads it as a heading", () => {
    const warnings = bridgeWarnings(raw("Texto que se convierte en título.\n---\n\nEl puente."));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/setext/);
  });

  it("names the line the setext trap would turn into a heading", () => {
    // frontmatter is 3 lines, then a blank, so the prose sits on line 5 and `---` on 6.
    const warnings = bridgeWarnings(raw("Texto.\n---\n\nEl puente."));
    expect(warnings[0]).toMatch(/line 6/);
    expect(warnings[0]).toMatch(/line 5/);
  });

  it("flags a `---` with nothing after it", () => {
    expect(bridgeWarnings(raw("Texto.\n\n---"))[0]).toMatch(/nothing follows/);
  });

  it("flags a heading after the break — the bridge closes the lesson", () => {
    const body = "Texto.\n\n---\n\nEl puente.\n\n## Y otra sección\n\nTexto.";
    expect(bridgeWarnings(raw(body))[0]).toMatch(/heading follows/);
  });

  it("does not read a `---` inside a code fence as a thematic break", () => {
    const body = "```python\nprint('---')\n---\n```\n\nTexto.\n\n---\n\nEl puente.";
    expect(bridgeWarnings(raw(body))).toEqual([]);
  });

  it("does not read the frontmatter delimiters as thematic breaks", () => {
    expect(bridgeWarnings(lesson("Texto."))).toEqual([]);
  });

  it("accepts `***` and `___`, which markdown treats identically", () => {
    expect(bridgeWarnings(raw("Texto.\n\n***\n\nEl puente."))).toEqual([]);
  });
});
