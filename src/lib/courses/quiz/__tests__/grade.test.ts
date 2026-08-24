/*
 * COURSE-P3-01 — Unit tests for the pure quiz grader.
 *
 * This is the bulk of the task's test coverage by design: grading is where a bug is
 * both invisible (a student is simply told the wrong thing) and cheap to prevent.
 */

import type {
  BooleanQuizQuestion,
  MultiQuizQuestion,
  NumericQuizQuestion,
  PredictOutputQuizQuestion,
  SingleQuizQuestion,
} from "@/domain/types";

import { gradeQuestion, normaliseOutput } from "../grade";

const single: SingleQuizQuestion = {
  id: "q-single",
  type: "single",
  prompt: "¿Por qué se desvanece el gradiente?",
  explanation: "Producto de derivadas < 1.",
  options: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
  ],
  answer: "b",
};

const multi: MultiQuizQuestion = {
  id: "q-multi",
  type: "multi",
  prompt: "¿Cuáles saturan?",
  explanation: "Sigmoide y tanh.",
  options: [
    { id: "a", text: "sigmoide" },
    { id: "b", text: "tanh" },
    { id: "c", text: "relu" },
  ],
  answer: ["a", "b"],
};

const boolean: BooleanQuizQuestion = {
  id: "q-bool",
  type: "boolean",
  prompt: "ReLU es lineal.",
  explanation: "Es lineal a trozos, no lineal.",
  answer: false,
};

const numeric: NumericQuizQuestion = {
  id: "q-num",
  type: "numeric",
  prompt: "Calcula 0.1 + 0.2",
  explanation: "0.3",
  answer: 0.3,
  tolerance: 0.001,
};

const predict: PredictOutputQuizQuestion = {
  id: "q-predict",
  type: "predict-output",
  prompt: "¿Qué imprime?",
  explanation: "Broadcasting suma 1 a cada elemento.",
  code: "print(np.arange(3) + 1)",
  answer: "[1 2 3]",
};

describe("gradeQuestion — single", () => {
  it("marks the matching option id correct", () => {
    expect(gradeQuestion(single, "b").correct).toBe(true);
  });

  it("marks any other option incorrect", () => {
    expect(gradeQuestion(single, "a").correct).toBe(false);
  });

  it("treats an unanswered question as incorrect, not an error", () => {
    const result = gradeQuestion(single, null);
    expect(result.correct).toBe(false);
    expect(result.answer).toBeNull();
  });

  it("reports the question id and type on the result", () => {
    expect(gradeQuestion(single, "b")).toMatchObject({ quizId: "q-single", type: "single" });
  });
});

describe("gradeQuestion — multi (all-or-nothing)", () => {
  it("accepts the exact set regardless of the order it was clicked in", () => {
    expect(gradeQuestion(multi, ["b", "a"]).correct).toBe(true);
  });

  it("rejects a SUBSET — there is no partial credit", () => {
    expect(gradeQuestion(multi, ["a"]).correct).toBe(false);
  });

  it("rejects a SUPERSET", () => {
    expect(gradeQuestion(multi, ["a", "b", "c"]).correct).toBe(false);
  });

  it("rejects an empty selection", () => {
    expect(gradeQuestion(multi, []).correct).toBe(false);
  });

  it("normalises the recorded answer: deduped and sorted", () => {
    expect(gradeQuestion(multi, ["b", "a", "b"]).answer).toEqual(["a", "b"]);
  });

  it("ignores duplicates when deciding correctness", () => {
    expect(gradeQuestion(multi, ["a", "a", "b"]).correct).toBe(true);
  });
});

describe("gradeQuestion — boolean", () => {
  it("matches the declared boolean", () => {
    expect(gradeQuestion(boolean, false).correct).toBe(true);
    expect(gradeQuestion(boolean, true).correct).toBe(false);
  });

  it("treats a non-boolean answer as incorrect rather than throwing", () => {
    expect(gradeQuestion(boolean, "false").correct).toBe(false);
    expect(gradeQuestion(boolean, null).correct).toBe(false);
  });
});

describe("gradeQuestion — numeric tolerance", () => {
  it("accepts floating-point noise: 0.1 + 0.2 matches 0.3", () => {
    expect(gradeQuestion(numeric, 0.1 + 0.2).correct).toBe(true);
  });

  it("accepts a value just inside the tolerance", () => {
    expect(gradeQuestion(numeric, 0.3005).correct).toBe(true);
  });

  it("accepts a value exactly at the tolerance boundary", () => {
    // 2 ± 0.5 with clean binary fractions, so the boundary is exact.
    const q: NumericQuizQuestion = { ...numeric, answer: 2, tolerance: 0.5 };
    expect(gradeQuestion(q, 2.5).correct).toBe(true);
    expect(gradeQuestion(q, 1.5).correct).toBe(true);
  });

  it("rejects a value just outside the tolerance", () => {
    const q: NumericQuizQuestion = { ...numeric, answer: 2, tolerance: 0.5 };
    expect(gradeQuestion(q, 2.6).correct).toBe(false);
  });

  it("supports a zero tolerance for an exact integer answer", () => {
    const q: NumericQuizQuestion = { ...numeric, answer: 4, tolerance: 0 };
    expect(gradeQuestion(q, 4).correct).toBe(true);
    expect(gradeQuestion(q, 4.0001).correct).toBe(false);
  });

  it("treats a missing or non-finite answer as incorrect", () => {
    expect(gradeQuestion(numeric, null).correct).toBe(false);
    expect(gradeQuestion(numeric, Number.NaN).correct).toBe(false);
    expect(gradeQuestion(numeric, Number.POSITIVE_INFINITY).correct).toBe(false);
  });
});

describe("gradeQuestion — predict-output", () => {
  it("matches the expected stdout", () => {
    expect(gradeQuestion(predict, "[1 2 3]").correct).toBe(true);
  });

  it("ignores trailing whitespace and surrounding blank lines", () => {
    expect(gradeQuestion(predict, "\n[1 2 3]   \n\n").correct).toBe(true);
  });

  it("ignores CRLF line endings", () => {
    const q: PredictOutputQuizQuestion = { ...predict, answer: "1\n2" };
    expect(gradeQuestion(q, "1\r\n2").correct).toBe(true);
  });

  it("stays case-sensitive — Python's output is", () => {
    const q: PredictOutputQuizQuestion = { ...predict, answer: "True" };
    expect(gradeQuestion(q, "true").correct).toBe(false);
  });

  it("does NOT collapse interior whitespace", () => {
    expect(gradeQuestion(predict, "[1  2  3]").correct).toBe(false);
  });

  it("treats an empty answer as incorrect", () => {
    expect(gradeQuestion(predict, "").correct).toBe(false);
    expect(gradeQuestion(predict, "   ").correct).toBe(false);
  });
});

describe("gradeQuestion — attempt metadata", () => {
  it("defaults to attempt 1 with no hint used", () => {
    expect(gradeQuestion(single, "b")).toMatchObject({ hintUsed: false, attempt: 1 });
  });

  it("carries the caller's hint and attempt through to the result", () => {
    expect(gradeQuestion(single, "a", { hintUsed: true, attempt: 3 })).toMatchObject({
      hintUsed: true,
      attempt: 3,
      correct: false,
    });
  });
});

describe("normaliseOutput", () => {
  it("strips trailing whitespace per line but keeps interior blank lines", () => {
    expect(normaliseOutput("a  \n\nb\t\n")).toBe("a\n\nb");
  });
});
