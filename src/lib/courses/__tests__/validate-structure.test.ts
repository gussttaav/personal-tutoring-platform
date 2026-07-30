/*
 * COURSE-P5-00 — Tests for the "don't ship the scaffolding" rule.
 *
 * The six-step structure is an authoring tool. Rendered as literal headings it becomes a
 * reader interface, and a bad one. This check is the machine-checkable half of that rule:
 * a heading may not be named after a step.
 */

import { structureWarnings } from "../validate-structure";

function lesson(body: string): string {
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
});
