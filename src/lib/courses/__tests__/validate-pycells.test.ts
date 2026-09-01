/*
 * COURSE-P2-03 — Tests for the `<PyCell>` ⇄ `hasCode` content lint.
 *
 * `hasCode` is the flag the reader trusts to know whether a lesson needs the Python
 * runtime at all. A flag that documents an invariant nothing checks drifts, so both
 * directions of disagreement have to fail — and the lint has to stay quiet about the
 * cases the P1-02 Zod schema already owns.
 */

import { hasPyCell, pyCellProblems, readHasCode } from "../validate-pycells";

function lesson(hasCode: string, body: string): string {
  return `---
slug: demo
title: "Demo"
hasCode: ${hasCode}
---

${body}
`;
}

describe("hasPyCell", () => {
  it("finds a self-closing cell", () => {
    expect(hasPyCell('<PyCell code={`print(1)`} />')).toBe(true);
  });

  it("finds a cell with props spread over several lines", () => {
    expect(hasPyCell('<PyCell\n  packages={["numpy"]}\n  code={`x = 1`}\n/>')).toBe(true);
  });

  it("does not match a longer component name", () => {
    expect(hasPyCell("<PyCellClient code={`x`} />")).toBe(false);
  });

  it("is false for prose with no cell", () => {
    expect(hasPyCell("Texto normal con `código` en línea.")).toBe(false);
  });

  // COURSE-P3-02: `hasCode` means "runs Python", and a challenge runs the student's
  // Python through the same worker.
  it("counts a <CodeChallenge> as running Python", () => {
    expect(hasPyCell('<CodeChallenge id="ch-softmax" />')).toBe(true);
  });

  it("does not match a longer challenge component name", () => {
    expect(hasPyCell('<CodeChallengeCard id="ch1" />')).toBe(false);
  });
});

describe("readHasCode", () => {
  it("reads true and false", () => {
    expect(readHasCode(lesson("true", ""))).toBe(true);
    expect(readHasCode(lesson("false", ""))).toBe(false);
  });

  it("returns null when the field is absent", () => {
    expect(readHasCode("---\nslug: demo\n---\n\nTexto")).toBeNull();
  });
});

describe("pyCellProblems", () => {
  it("accepts a cell in a lesson that declares hasCode", () => {
    expect(pyCellProblems(lesson("true", '<PyCell code={`print(1)`} />'))).toEqual([]);
  });

  it("accepts prose with hasCode false", () => {
    expect(pyCellProblems(lesson("false", "Solo texto."))).toEqual([]);
  });

  it("rejects a cell in a lesson that declares hasCode false", () => {
    const problems = pyCellProblems(lesson("false", '<PyCell code={`print(1)`} />'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/hasCode: false/);
  });

  it("rejects hasCode true with no cell in the body", () => {
    const problems = pyCellProblems(lesson("true", "Solo texto."));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/no <PyCell>/);
  });

  it("stays silent when hasCode is missing — that is the Zod schema's error to raise", () => {
    expect(pyCellProblems("---\nslug: demo\n---\n\n<PyCell code={`x`} />")).toEqual([]);
  });

  it("accepts a challenge-only lesson that declares hasCode", () => {
    expect(pyCellProblems(lesson("true", '<CodeChallenge id="ch-softmax" />'))).toEqual([]);
  });

  it("rejects a challenge-only lesson that declares hasCode false", () => {
    const problems = pyCellProblems(lesson("false", '<CodeChallenge id="ch-softmax" />'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/hasCode: false/);
  });
});
