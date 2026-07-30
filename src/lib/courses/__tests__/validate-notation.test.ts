/*
 * COURSE-P5-00 — Tests for the notation contract's machine-checkable subset.
 *
 * Two things are being protected here, and the second matters more:
 *   1. every rule fires on the violation it names;
 *   2. NO rule fires on correct notation. A false positive on a correct lesson is how
 *      a warning becomes noise, and a noisy warning is skipped past for 40 lessons —
 *      which is worse than not having the rule, because it also teaches the author to
 *      skip past the rules that are right.
 */

import { mathSpans, notationWarnings } from "../validate-notation";

/** Wrap a body in the minimum frontmatter, so `matter()` splits it the same way it
 *  does for a real lesson. */
function lesson(body: string, frontmatter = ""): string {
  return `---\nslug: demo\n${frontmatter}\n---\n\n${body}\n`;
}

describe("mathSpans", () => {
  it("finds display blocks and inline math in the body", () => {
    const spans = mathSpans(lesson("Texto $a^2$ y\n\n$$\nb = c\n$$\n"));
    expect(spans.some((s) => s.includes("a^2"))).toBe(true);
    expect(spans.some((s) => s.includes("b = c"))).toBe(true);
  });

  it("finds inline math in the frontmatter — quiz prompts are full of it", () => {
    const spans = mathSpans(lesson("Texto", "prompt: 'Calcula $\\sigma(0)$'"));
    expect(spans.some((s) => s.includes("\\sigma(0)"))).toBe(true);
  });

  it("ignores `$` inside a code fence", () => {
    expect(mathSpans(lesson("```bash\necho $HOME $PATH\n```\n"))).toEqual([]);
  });

  it("ignores `$` inside inline code", () => {
    expect(mathSpans(lesson("Escribe `$HOME` en la terminal."))).toEqual([]);
  });
});

describe("notationWarnings", () => {
  it("accepts notation that follows the contract", () => {
    const body = [
      "$$",
      "\\mathbf{h}^{(l)} = \\sigma\\!\\left(\\mathbf{W}^{(l)} \\mathbf{h}^{(l-1)} + \\mathbf{b}^{(l)}\\right)",
      "$$",
      "",
      "La pérdida es $\\mathcal{L}$, la tasa de aprendizaje $\\eta$ y la dimensión $d_{\\text{model}}$.",
      "",
      "$$",
      "\\mathcal{L} = -\\sum_{t=1}^{T} \\log p(y_t) \\qquad \\mathbf{A} = \\mathbf{Q}\\mathbf{K}^{\\top}",
      "$$",
    ].join("\n");
    expect(notationWarnings(lesson(body))).toEqual([]);
  });

  it("does not read a summation limit as a transpose", () => {
    // `\sum_{t=1}^{T}` is correct and appears in nearly every lesson from Block 2 on.
    expect(notationWarnings(lesson("$\\sum_{t=1}^{T} x_t$"))).toEqual([]);
    expect(notationWarnings(lesson("$\\prod_{i=1}^{T} p_i$"))).toEqual([]);
  });

  it("rejects \\bf, \\textbf, \\boldsymbol and \\vec", () => {
    for (const bad of ["$\\bf x$", "$\\textbf{x}$", "$\\boldsymbol{x}$", "$\\vec{x}$"]) {
      expect(notationWarnings(lesson(bad))[0]).toMatch(/\\mathbf/);
    }
  });

  it("rejects a weight matrix written as a plain W", () => {
    expect(notationWarnings(lesson("$\\hat{y} = \\sigma(Wx + b)$"))[0]).toMatch(/plain W/);
  });

  it("accepts \\mathbf{W}", () => {
    expect(notationWarnings(lesson("$\\hat{\\mathbf{y}} = \\sigma(\\mathbf{W}\\mathbf{x})$"))).toEqual([]);
  });

  it("rejects a layer index outside parentheses", () => {
    expect(notationWarnings(lesson("$\\mathbf{h}^l$"))[0]).toMatch(/parentheses/);
    expect(notationWarnings(lesson("$\\mathbf{h}^{l+1}$"))[0]).toMatch(/parentheses/);
  });

  it("rejects d_model without \\text{}", () => {
    expect(notationWarnings(lesson("$d_{model}$"))[0]).toMatch(/d_\{\\text\{model\}\}/);
    expect(notationWarnings(lesson("$d_model$"))[0]).toMatch(/d_\{\\text\{model\}\}/);
  });

  it("rejects ^T for transpose and ^t for time", () => {
    expect(notationWarnings(lesson("$\\mathbf{x}^T$"))[0]).toMatch(/\\top/);
    expect(notationWarnings(lesson("$\\mathbf{h}^{t}$"))[0]).toMatch(/\\top/);
  });

  it("does not read a shape as a transpose", () => {
    // `\mathbb{R}^{T \times d}` is the most common correct `T` superscript in the
    // course, and it appears in Block 0 lesson 1.
    expect(notationWarnings(lesson("$\\mathbf{X} \\in \\mathbb{R}^{T \\times d}$"))).toEqual([]);
    expect(notationWarnings(lesson("$\\mathbb{R}^{B \\times T \\times d}$"))).toEqual([]);
  });

  it("reports each rule once, however many equations break it", () => {
    const body = "$Wx$\n\n$Wy$\n\n$Wz$";
    expect(notationWarnings(lesson(body))).toHaveLength(1);
  });

  it("says nothing about prose that merely mentions a symbol", () => {
    expect(notationWarnings(lesson("La matriz W se llama así por *weights*."))).toEqual([]);
  });
});
