/*
 * COURSE-P5-00 — Tests for the per-lesson budget.
 *
 * The counting is the part worth testing hard. A word count that includes LaTeX and
 * code reports every maths-heavy lesson as over budget, which trains authors to ignore
 * the warning — and a warning nobody reads is worse than no warning, because it costs
 * the same and buys nothing.
 */

import {
  budgetWarnings,
  countDisplayEquations,
  countWords,
  isBudgetExempt,
  lessonCounts,
  prose,
} from "../budget";

/** A lesson source with `n` prose words in its body, plus whatever else is asked for. */
function lesson({
  words = 0,
  minutes = 25,
  quiz = 0,
  challenges = 0,
  body = "",
}: {
  words?: number;
  minutes?: number;
  quiz?: number;
  challenges?: number;
  body?: string;
}): string {
  const quizYaml =
    quiz === 0
      ? "quiz: []"
      : `quiz:\n${Array.from({ length: quiz }, (_, i) => `  - id: q${i}`).join("\n")}`;
  const challengeYaml =
    challenges === 0
      ? "challenges: []"
      : `challenges:\n${Array.from({ length: challenges }, (_, i) => `  - id: ch${i}`).join("\n")}`;

  return `---
slug: demo
minutes: ${minutes}
${quizYaml}
${challengeYaml}
---

${Array.from({ length: words }, () => "palabra").join(" ")}

${body}
`;
}

describe("countWords", () => {
  it("counts plain prose", () => {
    expect(countWords("Una frase de cinco palabras.")).toBe(5);
  });

  it("excludes fenced code — a code block is not reading", () => {
    const source = "Dos palabras\n\n```python\nimport numpy as np\nprint(np.arange(3) + 1)\n```\n";
    expect(countWords(source)).toBe(2);
  });

  it("excludes display math", () => {
    expect(countWords("Dos palabras\n\n$$\n\\frac{\\partial L}{\\partial w}\n$$\n")).toBe(2);
  });

  it("excludes inline math", () => {
    expect(countWords("Dos palabras $a^2 + b^2 = c^2$")).toBe(2);
  });

  it("excludes a <PyCell> template literal, backticks, dollars and all", () => {
    const source = 'Dos palabras\n\n<PyCell packages={["numpy"]} code={`\nimport numpy as np\nprint("$x$ hola mundo")\n`} />\n';
    expect(countWords(source)).toBe(2);
  });

  it("excludes MDX comments", () => {
    expect(countWords("Dos palabras\n\n{/* una nota para el autor, no para el estudiante */}")).toBe(2);
  });

  it("excludes inline code but keeps link text", () => {
    expect(countWords("Ver `numpy` en [la documentación](https://example.com)")).toBe(4);
  });

  it("does not count table rules or bullet markers as words", () => {
    expect(countWords("| Capa | Salida |\n|------|--------|\n| Densa | ReLU |")).toBe(4);
  });
});

describe("prose", () => {
  it("leaves ordinary prose untouched enough to read", () => {
    expect(prose("El **gradiente** apunta hacia arriba.")).toContain("gradiente");
  });

  it("drops the contents of a JSX expression prop entirely", () => {
    expect(prose('<Explorable id="x" caption="pie" />')).not.toContain("pie");
  });
});

describe("countDisplayEquations", () => {
  it("counts a block whose fences are on their own lines", () => {
    expect(countDisplayEquations("$$\na = b\n$$\n")).toBe(1);
  });

  it("counts several blocks", () => {
    expect(countDisplayEquations("$$\na\n$$\n\ntexto\n\n$$\nb\n$$\n")).toBe(2);
  });

  it("does not count single-line $$…$$ — remark-math renders that INLINE", () => {
    expect(countDisplayEquations("texto $$a = b$$ más texto")).toBe(0);
  });

  it("does not count $$ inside a code fence", () => {
    expect(countDisplayEquations("```bash\necho $$\necho $$\n```\n")).toBe(0);
  });

  it("is zero for prose with no maths", () => {
    expect(countDisplayEquations("Sólo texto.")).toBe(0);
  });
});

describe("lessonCounts", () => {
  it("reads the interactive counts off the body and the frontmatter", () => {
    const source = lesson({
      words: 1500,
      minutes: 25,
      quiz: 4,
      challenges: 1,
      body: [
        '<Explorable id="tokenizer-playground" />',
        "<PyCell code={`print(1)`} />",
        "$$\na = b\n$$",
      ].join("\n\n"),
    });
    const counts = lessonCounts(source);
    expect(counts).toMatchObject({
      words: 1500,
      minutes: 25,
      displayEquations: 1,
      widgets: 1,
      codeCells: 1,
      quizQuestions: 4,
      challenges: 1,
    });
  });

  it("estimates minutes from prose plus a flat cost for the interactive parts", () => {
    // 1,800 words at 120 wpm = 15 min of study, + 1 widget (2) + 1 cell (3).
    const source = lesson({
      words: 1800,
      body: '<Explorable id="tokenizer-playground" />\n\n<PyCell code={`print(1)`} />',
    });
    expect(lessonCounts(source).estimatedMinutes).toBe(20);
  });

  it("counts a widget embedded twice twice — the student pays for both", () => {
    const body = '<Explorable id="tokenizer-playground" />\n\n<Explorable id="loss-landscape" />';
    expect(lessonCounts(lesson({ body })).widgets).toBe(2);
  });

  it("does not count a component merely NAMED in prose or in backticks", () => {
    const body = [
      "<PyCell code={`print(1)`} />",
      "El código no ejecutable va en `<Quiz>`; para ejecutarlo está `<PyCell>`.",
      "```mdx",
      '<PyCell code={`print(2)`} />',
      "```",
    ].join("\n\n");
    expect(lessonCounts(lesson({ body })).codeCells).toBe(1);
  });
});

describe("budgetWarnings", () => {
  const inBudget = lessonCounts(
    lesson({
      words: 1600,
      minutes: 25,
      quiz: 4,
      body: '<Explorable id="tokenizer-playground" />\n\n<PyCell code={`print(1)`} />\n\n' +
        Array.from({ length: 8 }, () => "$$\na = b\n$$").join("\n\n"),
    }),
  );

  it("says nothing about a lesson inside every band", () => {
    expect(budgetWarnings(inBudget)).toEqual([]);
  });

  it("warns over the target band, naming the band", () => {
    const warnings = budgetWarnings({ ...inBudget, words: 2400 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/words: 2400 — over budget \(target 1200–2000, ceiling 3000\)/);
  });

  it("tells the author to split past the hard ceiling", () => {
    expect(budgetWarnings({ ...inBudget, words: 3400 })[0]).toMatch(/split this lesson/);
  });

  it("warns under the target on words and quiz questions", () => {
    expect(budgetWarnings({ ...inBudget, words: 400 })[0]).toMatch(/under budget/);
    expect(budgetWarnings({ ...inBudget, quizQuestions: 1 })[0]).toMatch(/quiz questions: 1/);
  });

  it("does NOT warn when reading time is below the target band", () => {
    // `words` already measures whether a lesson is substantial, and a prose-only
    // lesson cannot clear a 20-minute floor without exceeding the 2,000-word target —
    // so the floor could only ever fire on lessons that were fine.
    expect(budgetWarnings({ ...inBudget, minutes: 18 })).toEqual([]);
    expect(budgetWarnings({ ...inBudget, minutes: 14, estimatedMinutes: 14 })).toEqual([]);
  });

  it("still warns past the reading-time ceiling — a 40-minute lesson should split", () => {
    const warnings = budgetWarnings({ ...inBudget, minutes: 50 });
    expect(warnings.some((w) => /reading time.*split this lesson/.test(w))).toBe(true);
  });

  it("still warns over the reading-time target band", () => {
    const warnings = budgetWarnings({ ...inBudget, minutes: 35, estimatedMinutes: 35 });
    expect(warnings.some((w) => /reading time \(min\): 35 — over budget/.test(w))).toBe(true);
  });

  it("stays quiet about a lesson with no widget and no code cell — that is a choice", () => {
    // Block 0 lesson 1 is deliberately prose-only; warning every run would train
    // authors to skip the warnings that matter.
    expect(budgetWarnings({ ...inBudget, widgets: 0, codeCells: 0, displayEquations: 0 })).toEqual([]);
  });

  it("flags a declared `minutes` the content does not support", () => {
    const warnings = budgetWarnings({ ...inBudget, minutes: 25, estimatedMinutes: 2 });
    expect(warnings.some((w) => /the content implies/.test(w))).toBe(true);
  });

  it("does not flag a small divergence between declared and estimated minutes", () => {
    const warnings = budgetWarnings({ ...inBudget, minutes: 25, estimatedMinutes: 22 });
    expect(warnings.some((w) => /the content implies/.test(w))).toBe(false);
  });
});

describe("isBudgetExempt", () => {
  it("recognises the opt-out marker", () => {
    expect(isBudgetExempt("{/* content-budget: ignore — fixture, not a lesson */}")).toBe(true);
  });

  it("is false for an ordinary lesson", () => {
    expect(isBudgetExempt(lesson({ words: 1500 }))).toBe(false);
  });
});
