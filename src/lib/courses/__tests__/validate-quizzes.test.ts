/*
 * COURSE-P3-01 — Tests for the `<Quiz id>` ⇄ frontmatter content lint.
 *
 * Quiz questions live in frontmatter and are placed in the prose by id, which is a
 * reference TypeScript cannot check. A typo renders nothing in production, so it has
 * to fail the lint instead — and, like the sibling lints, it must stay quiet about the
 * cases the P1-02 Zod schema already owns.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  findQuizRefs,
  frontmatterQuizIds,
  quizProblems,
  validateQuizRefs,
} from "../validate-quizzes";

// The parameter type is annotated rather than inferred from the defaults: `hasQuiz`
// defaults off `ids` within the same destructuring pattern, and that self-reference
// makes TypeScript fall back to `any` for `ids` (TS7022) and for its `.map` callback
// (TS7006) — errors `tsc --noEmit` reports even though Jest runs the file happily.
function lesson({
  ids = [],
  hasQuiz = ids.length > 0,
  body = "",
}: {
  ids?: string[];
  hasQuiz?: boolean;
  body?: string;
}): string {
  const quiz =
    ids.length === 0
      ? "quiz: []"
      : `quiz:\n${ids
          .map((id) => `  - id: ${id}\n    type: boolean\n    prompt: "p"\n    explanation: "e"\n    answer: true`)
          .join("\n")}`;

  return `---
slug: demo
title: "Demo"
hasQuiz: ${hasQuiz}
${quiz}
---

${body}
`;
}

describe("findQuizRefs", () => {
  it("finds a self-closing tag and captures the id", () => {
    expect(findQuizRefs('<Quiz id="q1" />')).toEqual([{ id: "q1" }]);
  });

  it("finds tags spread over several lines, in source order", () => {
    expect(findQuizRefs('<Quiz\n  id="q1"\n/>\n\ntexto\n\n<Quiz id="q2" />')).toEqual([
      { id: "q1" },
      { id: "q2" },
    ]);
  });

  it("reports a missing id as null rather than skipping the tag", () => {
    expect(findQuizRefs("<Quiz />")).toEqual([{ id: null }]);
  });

  it("does not match a longer component name", () => {
    expect(findQuizRefs('<QuizCard id="q1" />')).toEqual([]);
  });

  it("is empty for prose with no quiz", () => {
    expect(findQuizRefs("Sólo texto con `código`.")).toEqual([]);
  });
});

describe("frontmatterQuizIds", () => {
  it("reads the declared ids in order", () => {
    expect(frontmatterQuizIds(lesson({ ids: ["q1", "q2"] }))).toEqual(["q1", "q2"]);
  });

  it("is empty for an empty quiz list", () => {
    expect(frontmatterQuizIds(lesson({}))).toEqual([]);
  });
});

describe("quizProblems", () => {
  it("accepts a lesson whose <Quiz> ids all resolve", () => {
    expect(
      quizProblems(lesson({ ids: ["q1", "q2"], body: '<Quiz id="q1" />\n\n<Quiz id="q2" />' })),
    ).toEqual([]);
  });

  it("accepts a lesson with declared questions that are not all placed yet", () => {
    expect(quizProblems(lesson({ ids: ["q1", "q2"], body: '<Quiz id="q1" />' }))).toEqual([]);
  });

  it("accepts prose with no quiz at all", () => {
    expect(quizProblems(lesson({ body: "Sólo texto." }))).toEqual([]);
  });

  it("rejects an id with no matching question, naming the declared ids", () => {
    const problems = quizProblems(lesson({ ids: ["q1"], body: '<Quiz id="q-typo" />' }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/q-typo/);
    expect(problems[0]).toMatch(/declared ids: q1/);
  });

  it("rejects a <Quiz> in a lesson that declares no questions", () => {
    const problems = quizProblems(lesson({ hasQuiz: true, body: '<Quiz id="q1" />' }));
    expect(problems[0]).toMatch(/declares no quiz questions/);
  });

  it("rejects a missing id attribute", () => {
    expect(quizProblems(lesson({ ids: ["q1"], body: "<Quiz />" }))[0]).toMatch(/missing an id/);
  });

  it("rejects the same question placed twice", () => {
    const problems = quizProblems(
      lesson({ ids: ["q1"], body: '<Quiz id="q1" />\n\n<Quiz id="q1" />' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/more than once/);
  });

  it("rejects a <Quiz> in a lesson declaring hasQuiz: false", () => {
    const source = lesson({ ids: ["q1"], hasQuiz: false, body: '<Quiz id="q1" />' });
    expect(quizProblems(source)[0]).toMatch(/hasQuiz: false/);
  });

  it("rejects hasQuiz: true with no <Quiz> in the body", () => {
    expect(quizProblems(lesson({ ids: ["q1"], body: "Sólo texto." }))[0]).toMatch(/no <Quiz>/);
  });

  it("stays silent when hasQuiz is missing — that is the Zod schema's error to raise", () => {
    expect(quizProblems("---\nslug: demo\nquiz: []\n---\n\nTexto")).toEqual([]);
  });
});

describe("validateQuizRefs", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "quiz-lint-"));
    fs.mkdirSync(path.join(root, "demo", "es"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function write(name: string, source: string) {
    fs.writeFileSync(path.join(root, "demo", "es", name), source, "utf8");
  }

  it("passes when every reference resolves", () => {
    write("00-a.mdx", lesson({ ids: ["q1"], body: '<Quiz id="q1" />' }));
    write("01-b.mdx", lesson({ body: "Sólo texto." }));
    expect(() => validateQuizRefs(root)).not.toThrow();
  });

  it("throws naming the offending file", () => {
    write("00-a.mdx", lesson({ ids: ["q1"], body: '<Quiz id="q1" />' }));
    write("01-b.mdx", lesson({ ids: ["q1"], body: '<Quiz id="nope" />' }));
    expect(() => validateQuizRefs(root)).toThrow(/01-b\.mdx: .*nope/);
  });

  it("is a no-op when the content root does not exist", () => {
    expect(() => validateQuizRefs(path.join(root, "missing"))).not.toThrow();
  });
});
