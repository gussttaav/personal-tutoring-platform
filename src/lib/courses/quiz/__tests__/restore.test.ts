// COURSE-P4-04: turning a stored attempt back into an answer for the CURRENT question.
//
// The interesting cases are all the ones where the content moved after the attempt was
// written. Every one of them must produce `null` — the card then shows an honest badge
// instead of a verdict against an answer the student cannot see.
import type { QuizQuestion } from "@/domain/types";
import { restoreQuizAnswer } from "../restore";

const single: QuizQuestion = {
  id:          "q1",
  type:        "single",
  prompt:      "p",
  explanation: "e",
  options:     [{ id: "a", text: "A" }, { id: "b", text: "B" }],
  answer:      "b",
};

const multi: QuizQuestion = {
  id:          "q2",
  type:        "multi",
  prompt:      "p",
  explanation: "e",
  options:     [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }],
  answer:      ["a", "c"],
};

const boolean: QuizQuestion = {
  id: "q3", type: "boolean", prompt: "p", explanation: "e", answer: true,
};

const numeric: QuizQuestion = {
  id: "q4", type: "numeric", prompt: "p", explanation: "e", answer: 0.3, tolerance: 0.01,
};

const predict: QuizQuestion = {
  id: "q5", type: "predict-output", prompt: "p", explanation: "e", code: "print(1)", answer: "1",
};

/** What CourseProgressProvider writes (P4-02). */
const stored = (type: string, value: unknown, hintUsed = false) => ({
  kind: "quiz",
  questionType: type,
  value,
  hintUsed,
  attempt: 2,
});

describe("restoreQuizAnswer — the five question types round-trip", () => {
  it("single: an option that still exists", () => {
    expect(restoreQuizAnswer(single, stored("single", "a"))).toEqual({
      value: "a",
      hintUsed: false,
    });
  });

  it("multi: an id array, hint use carried along", () => {
    expect(restoreQuizAnswer(multi, stored("multi", ["a", "c"], true))).toEqual({
      value: ["a", "c"],
      hintUsed: true,
    });
  });

  it("boolean: `false` is a real answer, not an absent one", () => {
    expect(restoreQuizAnswer(boolean, stored("boolean", false))).toEqual({
      value: false,
      hintUsed: false,
    });
  });

  it("numeric: `0` is a real answer too", () => {
    expect(restoreQuizAnswer(numeric, stored("numeric", 0))).toEqual({
      value: 0,
      hintUsed: false,
    });
  });

  it("predict-output: the typed stdout", () => {
    expect(restoreQuizAnswer(predict, stored("predict-output", "1"))).toEqual({
      value: "1",
      hintUsed: false,
    });
  });
});

describe("restoreQuizAnswer — content drift is refused, never guessed", () => {
  it("refuses a payload written against a different question type", () => {
    // The author changed `single` → `multi` and kept the id.
    expect(restoreQuizAnswer(multi, stored("single", "a"))).toBeNull();
  });

  it("refuses an option id that no longer exists", () => {
    expect(restoreQuizAnswer(single, stored("single", "z"))).toBeNull();
  });

  it("refuses a multi selection if ANY id is gone — all-or-nothing grading", () => {
    expect(restoreQuizAnswer(multi, stored("multi", ["a", "gone"]))).toBeNull();
  });

  it("refuses an empty multi selection — it would grade wrong and show nothing", () => {
    expect(restoreQuizAnswer(multi, stored("multi", []))).toBeNull();
  });

  it("refuses a non-finite number (JSON turns NaN/Infinity into null)", () => {
    expect(restoreQuizAnswer(numeric, stored("numeric", null))).toBeNull();
  });

  it("refuses a numeric answer that arrived as a string", () => {
    expect(restoreQuizAnswer(numeric, stored("numeric", "0.3"))).toBeNull();
  });

  it("refuses empty typed output", () => {
    expect(restoreQuizAnswer(predict, stored("predict-output", ""))).toBeNull();
  });
});

describe("restoreQuizAnswer — hostile or absent payloads", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a bare string", "a"],
    ["a challenge payload", { kind: "challenge", passed: 3, total: 3 }],
    ["an object with no kind", { questionType: "single", value: "a" }],
  ])("returns null for %s", (_label, payload) => {
    expect(restoreQuizAnswer(single, payload)).toBeNull();
  });

  it("treats a missing hintUsed as false rather than truthy", () => {
    const payload = { kind: "quiz", questionType: "single", value: "a" };
    expect(restoreQuizAnswer(single, payload)).toEqual({ value: "a", hintUsed: false });
  });
});
