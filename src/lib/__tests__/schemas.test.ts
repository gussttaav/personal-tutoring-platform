// COURSE-P1-02 — Zod schema tests for the course manifest + lesson frontmatter.
//
// The load-bearing assertion here is `.strict()`: an unknown/typo'd key must be
// REJECTED, not silently dropped — that is the failure mode the registry exists to
// prevent (`mintues:` sailing through as valid).

import {
  CodeChallengeSchema,
  CourseManifestSchema,
  LessonFrontmatterSchema,
  QuizQuestionSchema,
} from "@/lib/schemas";

// ─── CourseManifestSchema ─────────────────────────────────────────────────────

describe("CourseManifestSchema", () => {
  const valid = {
    slug: "dl-nlp",
    title: "Curso",
    tagline: "...",
    level: "intermedio",
    estimatedHours: 40,
    prerequisites: ["Python"],
    blocks: [{ id: 0, title: "Bloque 0", summary: "..." }],
  };

  it("accepts a well-formed manifest", () => {
    expect(CourseManifestSchema.parse(valid)).toEqual(valid);
  });

  it("rejects an unknown key (strict)", () => {
    expect(() => CourseManifestSchema.parse({ ...valid, tittle: "typo" })).toThrow();
  });

  it("rejects an empty blocks array", () => {
    expect(() => CourseManifestSchema.parse({ ...valid, blocks: [] })).toThrow();
  });

  it("rejects a non-positive estimatedHours", () => {
    expect(() => CourseManifestSchema.parse({ ...valid, estimatedHours: 0 })).toThrow();
  });

  it("rejects an unknown key inside a block (strict, nested)", () => {
    expect(() =>
      CourseManifestSchema.parse({
        ...valid,
        blocks: [{ id: 0, title: "B", summary: "...", extra: true }],
      }),
    ).toThrow();
  });
});

// ─── LessonFrontmatterSchema ──────────────────────────────────────────────────

describe("LessonFrontmatterSchema", () => {
  const valid = {
    slug: "tokenizacion",
    title: "Tokenización",
    block: 0,
    order: 1,
    minutes: 25,
    summary: "...",
    draft: true,
    hasCode: false,
    hasQuiz: false,
    quiz: [],
    challenges: [],
  };

  it("accepts well-formed frontmatter", () => {
    expect(LessonFrontmatterSchema.parse(valid)).toEqual(valid);
  });

  it("rejects a typo'd key like `mintues` (strict) — the whole point", () => {
    const { minutes: _drop, ...rest } = valid;
    expect(() => LessonFrontmatterSchema.parse({ ...rest, mintues: 25 })).toThrow();
  });

  it("rejects a missing required field", () => {
    const { summary: _drop, ...rest } = valid;
    expect(() => LessonFrontmatterSchema.parse(rest)).toThrow();
  });

  it("rejects a non-integer minutes", () => {
    expect(() => LessonFrontmatterSchema.parse({ ...valid, minutes: 12.5 })).toThrow();
  });

  it("rejects a non-array quiz", () => {
    expect(() => LessonFrontmatterSchema.parse({ ...valid, quiz: "no" })).toThrow();
  });

  // COURSE-P3-01: the quiz array is no longer `unknown[]`.
  it("rejects a quiz entry that is not a real question", () => {
    expect(() => LessonFrontmatterSchema.parse({ ...valid, quiz: [{ anything: true }] })).toThrow();
  });

  it("rejects two questions sharing an id — `<Quiz id>` would be ambiguous", () => {
    const q = {
      id: "q1",
      type: "boolean",
      prompt: "¿Es lineal?",
      explanation: "No.",
      answer: false,
    };
    // Zod serialises its issues as JSON, so the id appears escaped in the message.
    expect(() => LessonFrontmatterSchema.parse({ ...valid, quiz: [q, { ...q }] })).toThrow(
      /duplicate quiz question id/,
    );
  });

  it("accepts distinct well-formed questions", () => {
    const parsed = LessonFrontmatterSchema.parse({
      ...valid,
      hasQuiz: true,
      quiz: [
        { id: "q1", type: "boolean", prompt: "p", explanation: "e", answer: true },
        { id: "q2", type: "numeric", prompt: "p", explanation: "e", answer: 0.3, tolerance: 0.001 },
      ],
    });
    expect(parsed.quiz).toHaveLength(2);
  });

  // COURSE-P3-02: the challenge array, same discipline as the quiz one.
  it("rejects two challenges sharing an id — `<CodeChallenge id>` would be ambiguous", () => {
    const challenge = {
      id: "ch1",
      prompt: "p",
      starter: "pass",
      tests: [{ name: "t", code: "assert True" }],
      solution: "pass",
      explanation: "e",
    };
    expect(() =>
      LessonFrontmatterSchema.parse({
        ...valid,
        hasCode: true,
        challenges: [challenge, { ...challenge }],
      }),
    ).toThrow(/duplicate challenge id/);
  });

  it("accepts a well-formed challenge", () => {
    const parsed = LessonFrontmatterSchema.parse({
      ...valid,
      hasCode: true,
      challenges: [
        {
          id: "ch-softmax",
          prompt: "Implementa softmax.",
          starter: "def softmax(x):\n    pass",
          tests: [{ name: "suma 1", code: "assert True" }],
          solution: "def softmax(x):\n    ...",
          explanation: "Resta el máximo.",
          packages: ["numpy"],
        },
      ],
    });
    expect(parsed.challenges).toHaveLength(1);
  });
});

// ─── CodeChallengeSchema ──────────────────────────────────────────────────────
//
// COURSE-P3-02. The failure that matters most is an empty `tests` array: a challenge
// with no assertions marks every submission — including an untouched starter — as a
// pass, which is worse than having no challenge at all.

describe("CodeChallengeSchema", () => {
  const valid = {
    id: "ch-softmax",
    prompt: "Implementa softmax de forma estable.",
    starter: "import numpy as np\n\ndef softmax(x):\n    pass",
    tests: [{ name: "suma 1", code: "assert np.isclose(softmax(np.ones(3)).sum(), 1.0)" }],
    solution: "def softmax(x):\n    ...",
    explanation: "Resta el máximo antes de exponenciar.",
  };

  it("accepts a well-formed challenge, with or without packages", () => {
    expect(CodeChallengeSchema.parse(valid)).toEqual(valid);
    expect(CodeChallengeSchema.parse({ ...valid, packages: ["numpy"] }).packages).toEqual(["numpy"]);
  });

  it("rejects an empty tests array — nothing could ever fail", () => {
    expect(() => CodeChallengeSchema.parse({ ...valid, tests: [] })).toThrow();
  });

  it("rejects a missing starter — the student would face a blank box", () => {
    const { starter: _drop, ...rest } = valid;
    expect(() => CodeChallengeSchema.parse(rest)).toThrow();
  });

  it("rejects an empty starter (a `starter: |` block scalar with nothing under it)", () => {
    expect(() => CodeChallengeSchema.parse({ ...valid, starter: "" })).toThrow();
  });

  it("rejects a missing reference solution — the reveal would have nothing to show", () => {
    const { solution: _drop, ...rest } = valid;
    expect(() => CodeChallengeSchema.parse(rest)).toThrow();
  });

  it("rejects a test with no assertion code", () => {
    expect(() =>
      CodeChallengeSchema.parse({ ...valid, tests: [{ name: "t", code: "" }] }),
    ).toThrow();
  });

  it("rejects two tests with the same name — the results list would be ambiguous", () => {
    expect(() =>
      CodeChallengeSchema.parse({
        ...valid,
        tests: [
          { name: "suma 1", code: "assert True" },
          { name: "suma 1", code: "assert False" },
        ],
      }),
    ).toThrow(/duplicate test name/);
  });

  it("rejects a typo'd key (strict)", () => {
    expect(() => CodeChallengeSchema.parse({ ...valid, solucion: "..." })).toThrow();
  });
});

// ─── QuizQuestionSchema ───────────────────────────────────────────────────────
//
// COURSE-P3-01. Two failure modes matter most, because both produce a question that
// LOOKS fine and can never be answered correctly: an `answer` naming an option that
// does not exist, and a missing `explanation` (which leaves nothing to learn from).

describe("QuizQuestionSchema", () => {
  const single = {
    id: "q-vanishing",
    type: "single",
    prompt: "¿Por qué se desvanece el gradiente?",
    explanation: "Producto de derivadas menores que 1.",
    options: [
      { id: "a", text: "..." },
      { id: "b", text: "..." },
    ],
    answer: "b",
  };

  it("accepts a well-formed single-choice question", () => {
    expect(QuizQuestionSchema.parse(single)).toEqual(single);
  });

  it("accepts an optional hint", () => {
    expect(QuizQuestionSchema.parse({ ...single, hint: "Piensa en el producto..." })).toMatchObject({
      hint: "Piensa en el producto...",
    });
  });

  it("rejects an answer that is not among the options", () => {
    expect(() => QuizQuestionSchema.parse({ ...single, answer: "z" })).toThrow(
      /not among the options/,
    );
  });

  it("rejects duplicate option ids", () => {
    expect(() =>
      QuizQuestionSchema.parse({
        ...single,
        options: [
          { id: "a", text: "..." },
          { id: "a", text: "..." },
        ],
      }),
    ).toThrow(/duplicate option id/);
  });

  it("rejects a missing explanation — every question must teach", () => {
    const { explanation: _drop, ...rest } = single;
    expect(() => QuizQuestionSchema.parse(rest)).toThrow();
  });

  it("rejects an empty explanation", () => {
    expect(() => QuizQuestionSchema.parse({ ...single, explanation: "" })).toThrow();
  });

  it("rejects an unknown question type", () => {
    expect(() => QuizQuestionSchema.parse({ ...single, type: "essay" })).toThrow();
  });

  it("rejects an unknown key (strict)", () => {
    expect(() => QuizQuestionSchema.parse({ ...single, points: 5 })).toThrow();
  });

  it("rejects a single-option question", () => {
    expect(() =>
      QuizQuestionSchema.parse({ ...single, options: [{ id: "b", text: "..." }] }),
    ).toThrow();
  });

  it("checks every id of a multi answer against the options", () => {
    const multi = { ...single, type: "multi", answer: ["a", "b"] };
    expect(QuizQuestionSchema.parse(multi)).toEqual(multi);
    expect(() => QuizQuestionSchema.parse({ ...multi, answer: ["a", "z"] })).toThrow(
      /not among the options/,
    );
  });

  it("requires an explicit tolerance on a numeric question", () => {
    const numeric = { id: "n", type: "numeric", prompt: "p", explanation: "e", answer: 0.3 };
    expect(() => QuizQuestionSchema.parse(numeric)).toThrow();
    expect(QuizQuestionSchema.parse({ ...numeric, tolerance: 0.001 })).toMatchObject({
      tolerance: 0.001,
    });
  });

  it("rejects a negative tolerance", () => {
    expect(() =>
      QuizQuestionSchema.parse({
        id: "n",
        type: "numeric",
        prompt: "p",
        explanation: "e",
        answer: 0.3,
        tolerance: -0.1,
      }),
    ).toThrow();
  });

  it("requires code on a predict-output question", () => {
    const predict = { id: "p", type: "predict-output", prompt: "p", explanation: "e", answer: "[1 2 3]" };
    expect(() => QuizQuestionSchema.parse(predict)).toThrow();
    expect(QuizQuestionSchema.parse({ ...predict, code: "print(1)" })).toMatchObject({
      code: "print(1)",
    });
  });
});
