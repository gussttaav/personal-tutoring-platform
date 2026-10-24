/*
 * CONTENT-DOLLAR-01 — Tests for "a `$` used as money is typeset as maths".
 *
 * Most of these assert SILENCE: the pass has to flag the pairs remark-math really builds
 * out of prices and stay quiet on every genuine formula, code span, escape and comment,
 * or authors learn to route around it.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  currencyDollarProblems,
  findCurrencyDollars,
  validateCurrencyDollars,
} from "../validate-currency-dollar";

/** A body under minimal frontmatter, so reported lines are FILE lines. Body starts at line 5. */
function post(body: string): string {
  return `---\nslug: demo\n---\n\n${body}\n`;
}

const lines = (source: string): number[] => findCurrencyDollars(post(source)).map((f) => f.line);

describe("findCurrencyDollars — flags money", () => {
  it("flags the Spanish form, a digit then a space before the sign", () => {
    const found = findCurrencyDollars(
      post("Cuesta 0,20 $ por millón de tokens y 0,0000166667 $ por token."),
    );
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(5);
    expect(found[0].snippet).toContain("por millón");
  });

  it("flags the Spanish form with no space before the sign", () => {
    expect(lines("Sale por 20$ al mes y 45$ al año.")).toEqual([5]);
  });

  it("flags the English form, $ then a digit, closed by the next amount's sign", () => {
    expect(lines("It costs $0.20 per million tokens and $0.50 per million output.")).toEqual([5]);
  });

  it("flags a pair whose body is a sentence even when the closing sign is a formula's", () => {
    expect(lines("Cuesta 0,20 $ por millón y luego $x$ crece.")).toEqual([5]);
  });

  it("reports the line of the opening sign when the pair spans a line break", () => {
    expect(lines("Una línea\ncuesta 0,20 $ por millón de\ntokens y 0,05 $ por caché.")).toEqual([6]);
  });

  it("counts the frontmatter in the line number", () => {
    const found = findCurrencyDollars("---\na: 1\nb: 2\n---\n\nSale por 5 $ hoy y 6 $ mañana.\n");
    expect(found.map((f) => f.line)).toEqual([6]);
  });

  it("flags money inside a list item, a heading and a table cell", () => {
    expect(lines("- cuesta 0,20 $ por millón y 0,50 $ por token")).toEqual([5]);
    expect(lines("## Sale por 5 $ y 6 $ al año")).toEqual([5]);
    expect(lines("| plan | precio |\n|---|---|\n| base | cuesta 0,20 $ y 0,50 $ |")).toEqual([7]);
  });

  it("flags money inside a blockquote and next to inline JSX", () => {
    expect(lines("> Sale por 5 $ hoy y 6 $ mañana.")).toEqual([5]);
    expect(lines("Sale <W>hoy</W> por 5 $ y mañana por 6 $.")).toEqual([5]);
  });
});

describe("findCurrencyDollars — stays silent", () => {
  it.each([
    ["genuine inline maths", "Sea $x$ y $y$ dos variables, con $n = 2$."],
    ["maths that starts with a digit", "UTF-8 la escribe con $195$ y $177$ (C3 y B1)."],
    ["a product with decimals", "Caben $64 \\cdot 2.16 \\approx 138$ bytes y $16 + 48 = 64$ filas."],
    ["a formula that ends in a digit", "El factor 3 $x_1$ y el 2 $y_2$ de arriba."],
    ["maths after a digit", "Los 3 $\\pi$ y los 2 $x$ de arriba."],
    ["an inline $$…$$", "El resultado es $$x = 1$$ y nada más."],
    ["a lone dollar, which renders literally", "Cuesta 0,20 $ por millón y nada más."],
    ["a lone English dollar", "It costs $0.20 per million tokens."],
    ["the word «dólares»", "Cuesta 0,20 dólares por millón y 0,50 dólares por token."],
    ["escaped English dollars", "It costs \\$0.20 per million and \\$0.50 per million."],
    ["escaped Spanish dollars", "Cuesta 0,20 \\$ por millón y 0,50 \\$ por token."],
    ["an inline code span", "Escribe `cuesta 0,20 $ por millón y 0,50 $` tal cual."],
    ["a double-backtick span", "Escribe ``el precio $0.20 y $0.50`` tal cual."],
    ["an MDX comment", "Texto. {/* cuesta 0,20 $ por millón y 0,50 $ */} Más texto."],
    ["a JSX attribute string", 'Mira <Figure alt="cuesta $0.20 y $0.50 al mes" src="/a.png" />'],
    ["a multi-line JSX tag", '<Figure\n  alt="cuesta 0,20 $ y 0,50 $"\n  src="/a.png"\n/>'],
  ])("%s", (_name, body) => {
    expect(lines(body)).toEqual([]);
  });

  it("ignores fenced code, with backticks or tildes", () => {
    expect(lines("```bash\necho 'cuesta 0,20 $ y 0,50 $'\n```")).toEqual([]);
    expect(lines("~~~\nprice = $0.20 and $0.50\n~~~")).toEqual([]);
  });

  it("ignores display maths fences", () => {
    expect(lines("$$\n5 \\text{ euros}\n$$\n\nCuesta 0,20 dólares.")).toEqual([]);
  });

  it("does not pair signs across list items, paragraphs or table cells", () => {
    expect(lines("- cuesta $5 el plan base\n- cuesta $10 el plan pro")).toEqual([]);
    expect(lines("Cuesta 5 $ al mes.\n\nY otros 6 $ al año.")).toEqual([]);
    expect(lines("| a | b |\n|---|---|\n| $5 | $10 |")).toEqual([]);
  });

  it("does not read the frontmatter as prose", () => {
    const source = "---\nexplanation: 'Cuesta 0,20 $ y 0,50 $'\n---\n\nTexto limpio.\n";
    expect(findCurrencyDollars(source)).toEqual([]);
  });

  it("keeps flagging after a code span that holds a dollar", () => {
    expect(lines("Usa `$HOME` y luego cuesta 0,20 $ por millón y 0,50 $ por token.")).toEqual([5]);
  });
});

describe("currencyDollarProblems", () => {
  const body = "Cuesta 0,20 $ por millón y 0,50 $ por token.";

  it("suggests «dólares» in Spanish", () => {
    const [problem] = currencyDollarProblems(post(body), "es");
    expect(problem).toMatch(/^line 5:/);
    expect(problem).toMatch(/dólares/);
  });

  it("suggests \\$ in English", () => {
    const [problem] = currencyDollarProblems(post("It costs $0.20 per million and $0.50 per token."), "en");
    expect(problem).toMatch(/^line 5:/);
    expect(problem).toMatch(/\\\$/);
    expect(problem).not.toMatch(/dólares/);
  });

  it("is empty for clean prose", () => {
    expect(currencyDollarProblems(post("Sea $x$ un número."))).toEqual([]);
  });
});

describe("validateCurrencyDollars", () => {
  let root: string;
  let courses: string;
  let blog: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "currency-dollar-"));
    courses = path.join(root, "courses");
    blog = path.join(root, "blog");
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  function write(dir: string, rel: string, source: string): string {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, source);
    return file;
  }

  it("is a no-op for missing roots and clean content", () => {
    expect(() => validateCurrencyDollars(courses, blog)).not.toThrow();
    write(blog, "es/limpio.mdx", post("Sea $x$ un número."));
    write(courses, "c/en/01-clean.mdx", post("A clean lesson."));
    expect(() => validateCurrencyDollars(courses, blog)).not.toThrow();
  });

  it("throws naming every offending post and lesson with its line", () => {
    write(blog, "es/precios.mdx", post("Cuesta 0,20 $ por millón y 0,50 $ por token."));
    write(courses, "c/en/01-prices.mdx", post("It costs $0.20 per million and $0.50 per token."));
    let message = "";
    try {
      validateCurrencyDollars(courses, blog);
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/2 place/);
    expect(message).toMatch(/precios\.mdx:5:/);
    expect(message).toMatch(/01-prices\.mdx:5:/);
    expect(message).toMatch(/dólares/); // the Spanish post
    expect(message).toMatch(/escape the dollar sign/); // the English lesson
  });

  it("skips _-prefixed templates", () => {
    write(blog, "es/_template.mdx", post("Cuesta 0,20 $ por millón y 0,50 $ por token."));
    write(courses, "c/_template.mdx", post("Cuesta 0,20 $ por millón y 0,50 $ por token."));
    expect(() => validateCurrencyDollars(courses, blog)).not.toThrow();
  });
});
