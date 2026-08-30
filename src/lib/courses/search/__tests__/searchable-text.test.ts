// COURSE-P9-01 — MDX → indexable prose, and the section split.

import { searchableText, splitSections } from "@/lib/courses/search/searchable-text";
import { extractHeadings } from "@/lib/courses/headings";
import { prose } from "@/lib/courses/budget";

describe("searchableText", () => {
  it("KEEPS <Leccion> children — the divergence from budget.prose()", () => {
    const src = 'Ver <Leccion slug="x">la lección sobre atención</Leccion> antes.';
    expect(searchableText(src)).toBe("Ver la lección sobre atención antes.");
    // The budget deliberately does the opposite; if this flips, P7-01's incentive broke.
    expect(prose(src)).not.toContain("atención");
  });

  it("drops the label-less self-closing <Leccion />", () => {
    expect(searchableText('Ver <Leccion slug="x" /> antes.')).toBe("Ver antes.");
  });

  it("keeps <W> children and reattaches the punctuation after them", () => {
    expect(searchableText("Toma <W>el gato</W>, y luego <W>bebe</W>.")).toBe("Toma el gato, y luego bebe.");
  });

  it("drops fenced code and PyCell literals", () => {
    const src = "Antes.\n\n```python\nimport numpy as np\n```\n\nDespues.";
    expect(searchableText(src)).toBe("Antes. Despues.");
    expect(searchableText('<PyCell code={`x = softmax(z)`} />')).toBe("");
  });

  it("drops inline and display math", () => {
    expect(searchableText("La matriz $\\mathbf{X}$ tiene forma.")).toBe("La matriz tiene forma.");
    expect(searchableText("Antes.\n\n$$\n\\frac{a}{b}\n$$\n\nDespues.")).toBe("Antes. Despues.");
  });

  it("drops inline math WRAPPED across a source line break", () => {
    // budget.prose() cannot: its inline pattern forbids \n, so the $ count goes odd and
    // raw LaTeX leaks into the snippet. Verified against 36-multi-head.mdx:50.
    const src = "con $\\mathbf{W}^Q_i \\in \\mathbb{R}^{d}\n\\times d_k$ y luego leen.";
    const out = searchableText(src);
    expect(out).not.toContain("$");
    expect(out).not.toContain("\\mathbf");
    expect(out).toContain("luego leen");
  });

  it("does not let a lone $ in prose swallow the sentence after it", () => {
    const src = "Cuesta 5 $ en total y despues seguimos hablando de tokens.";
    expect(searchableText(src)).toContain("despues seguimos hablando de tokens");
  });

  it("still agrees with budget.prose() wherever neither divergence applies", () => {
    /*
     * The canary. `searchableText` is a deliberate near-copy of `prose()`, and two copies
     * drift. On input with no <Leccion>, no tag-adjacent punctuation and no line-wrapped
     * math, the two chains must still produce the same prose — so an edit to either one
     * that was not meant to change behaviour fails here instead of silently diverging.
     */
    const neutral = [
      "Un parrafo normal con **negrita** y *cursiva*.",
      "",
      "```python",
      "x = softmax(z)",
      "```",
      "",
      "Otro parrafo con $a + b$ y un [enlace](https://example.dev) al final.",
    ].join("\n");
    /*
     * Divergence 2 (punctuation repair) is factored out on BOTH sides rather than dodged
     * with input that avoids it — `*cursiva*.` alone is enough to trigger it, so "input
     * that avoids it" would be too artificial to catch anything. What remains compared is
     * the shared strip chain, which is the part that must not drift.
     */
    const normalize = (text: string) =>
      text
        .replace(/\s+/g, " ")
        .replace(/\s+([,.;:!?)\]»…%])/g, "$1")
        .replace(/([(\[«¿¡])\s+/g, "$1")
        .trim();
    expect(normalize(searchableText(neutral))).toBe(normalize(prose(neutral)));
  });

  it("reduces links to their text", () => {
    expect(searchableText("Ver [el paper](https://arxiv.org/abs/1706.03762) aqui.")).toBe(
      "Ver el paper aqui.",
    );
  });
});

describe("splitSections", () => {
  const SRC = [
    "Prosa introductoria.",
    "",
    "## Primera seccion",
    "",
    "Cuerpo uno.",
    "",
    "### Sub seccion",
    "",
    "Cuerpo dos.",
    "",
    "```python",
    "## esto es un comentario, no un encabezado",
    "```",
    "",
    "Cuerpo tres.",
  ].join("\n");

  it("puts the prose before the first heading in a head section with no id", () => {
    const [head] = splitSections(SRC);
    expect(head).toEqual({ headingId: "", headingText: "", text: "Prosa introductoria." });
  });

  it("agrees with extractHeadings on ids, in document order", () => {
    const got = splitSections(SRC).map((s) => s.headingId).filter(Boolean);
    expect(got).toEqual(extractHeadings(SRC).map((h) => h.id));
  });

  it("does not split on a # inside a fenced block", () => {
    const sub = splitSections(SRC).find((s) => s.headingText === "Sub seccion");
    expect(sub?.text).toBe("Cuerpo dos. Cuerpo tres.");
  });

  it("consumes github-slugger's de-duplicated ids rather than re-slugging", () => {
    const dup = "## Repetida\n\nUno.\n\n## Repetida\n\nDos.";
    expect(splitSections(dup).map((s) => s.headingId)).toEqual(["repetida", "repetida-1"]);
  });

  it("drops sections whose prose is empty", () => {
    const widgetOnly = "## Solo widget\n\n<Explorable id=\"x\" />";
    expect(splitSections(widgetOnly)).toEqual([]);
  });
});
