/*
 * COURSE-P3-01 — Unit tests for the quiz state machine.
 *
 * The card's behaviour is asserted here rather than by rendering it: this repo runs
 * every unit test in the node environment with no jsdom and no RTL (see the P2-02
 * note in docs/courses/STATUS.md), so the logic worth testing was factored into a
 * pure reducer. What a render test would check — "answering produces a result of the
 * right shape", "retry resets the input but not the attempt count" — is checked here.
 */

import type {
  ExerciseAttemptHistory,
  MultiQuizQuestion,
  SingleQuizQuestion,
} from "@/domain/types";

import { canSubmit, createQuizReducer, initialQuizState } from "../state";

const single: SingleQuizQuestion = {
  id: "q-single",
  type: "single",
  prompt: "p",
  explanation: "e",
  hint: "una pista",
  options: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
  ],
  answer: "b",
};

const multi: MultiQuizQuestion = {
  id: "q-multi",
  type: "multi",
  prompt: "p",
  explanation: "e",
  options: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
  ],
  answer: ["a", "b"],
};

const reduce = createQuizReducer(single);
const reduceMulti = createQuizReducer(multi);

describe("initialQuizState", () => {
  it("starts unanswered with no attempts and no hint used", () => {
    expect(initialQuizState(single)).toEqual({
      selection: null,
      result: null,
      hintUsed: false,
      attempts: 0,
      // COURSE-P4-04 — nothing replayed until the history fetch lands.
      restored: false,
      previouslySolved: false,
      lastAttemptedAt: null,
    });
  });

  it("starts `multi` with an empty id array rather than null", () => {
    expect(initialQuizState(multi).selection).toEqual([]);
  });
});

describe("canSubmit", () => {
  it("is false with nothing selected", () => {
    expect(canSubmit(initialQuizState(single))).toBe(false);
  });

  it("is false for an empty multi selection and true once a box is ticked", () => {
    const empty = initialQuizState(multi);
    expect(canSubmit(empty)).toBe(false);
    expect(canSubmit(reduceMulti(empty, { kind: "toggle", optionId: "a" }))).toBe(true);
  });

  it("is false for whitespace-only typed output", () => {
    const state = reduce(initialQuizState(single), { kind: "select", value: "   " });
    expect(canSubmit(state)).toBe(false);
  });

  it("accepts `false` and `0` as real answers", () => {
    const base = initialQuizState(single);
    expect(canSubmit({ ...base, selection: false })).toBe(true);
    expect(canSubmit({ ...base, selection: 0 })).toBe(true);
  });

  it("is false once an answer has been submitted", () => {
    let state = reduce(initialQuizState(single), { kind: "select", value: "b" });
    state = reduce(state, { kind: "submit" });
    expect(canSubmit(state)).toBe(false);
  });
});

describe("quizReducer — answering", () => {
  it("produces a result carrying the id, verdict, answer, hint use and attempt", () => {
    let state = reduce(initialQuizState(single), { kind: "select", value: "b" });
    state = reduce(state, { kind: "submit" });

    expect(state.result).toEqual({
      quizId: "q-single",
      type: "single",
      correct: true,
      answer: "b",
      hintUsed: false,
      attempt: 1,
    });
    expect(state.attempts).toBe(1);
  });

  it("records an incorrect answer without throwing", () => {
    let state = reduce(initialQuizState(single), { kind: "select", value: "a" });
    state = reduce(state, { kind: "submit" });
    expect(state.result).toMatchObject({ correct: false, answer: "a" });
  });

  it("ignores a submit with nothing selected — no attempt is burned", () => {
    const state = reduce(initialQuizState(single), { kind: "submit" });
    expect(state.result).toBeNull();
    expect(state.attempts).toBe(0);
  });

  it("locks the input once submitted", () => {
    let state = reduce(initialQuizState(single), { kind: "select", value: "a" });
    state = reduce(state, { kind: "submit" });
    state = reduce(state, { kind: "select", value: "b" });
    expect(state.selection).toBe("a");
  });

  it("toggles multi options on and off", () => {
    let state = reduceMulti(initialQuizState(multi), { kind: "toggle", optionId: "a" });
    state = reduceMulti(state, { kind: "toggle", optionId: "b" });
    expect(state.selection).toEqual(["a", "b"]);
    state = reduceMulti(state, { kind: "toggle", optionId: "a" });
    expect(state.selection).toEqual(["b"]);
  });
});

describe("quizReducer — retry", () => {
  it("clears the input and the verdict but KEEPS the attempt count", () => {
    let state = reduce(initialQuizState(single), { kind: "select", value: "a" });
    state = reduce(state, { kind: "submit" });
    state = reduce(state, { kind: "retry" });

    expect(state.selection).toBeNull();
    expect(state.result).toBeNull();
    expect(state.attempts).toBe(1);
  });

  it("numbers the second attempt 2", () => {
    let state = reduce(initialQuizState(single), { kind: "select", value: "a" });
    state = reduce(state, { kind: "submit" });
    state = reduce(state, { kind: "retry" });
    state = reduce(state, { kind: "select", value: "b" });
    state = reduce(state, { kind: "submit" });

    expect(state.result).toMatchObject({ attempt: 2, correct: true });
  });

  it("produces a NEW result object even when the same answer is resubmitted, so the\n     component fires onAnswered once per attempt", () => {
    let state = reduce(initialQuizState(single), { kind: "select", value: "b" });
    state = reduce(state, { kind: "submit" });
    const first = state.result;

    state = reduce(state, { kind: "retry" });
    state = reduce(state, { kind: "select", value: "b" });
    state = reduce(state, { kind: "submit" });

    expect(state.result).not.toBe(first);
    expect(state.result).toMatchObject({ attempt: 2 });
  });

  it("does nothing before an answer has been submitted", () => {
    const state = reduce(initialQuizState(single), { kind: "select", value: "b" });
    expect(reduce(state, { kind: "retry" })).toBe(state);
  });

  it("restores `multi` to an empty array, not null", () => {
    let state = reduceMulti(initialQuizState(multi), { kind: "toggle", optionId: "a" });
    state = reduceMulti(state, { kind: "submit" });
    state = reduceMulti(state, { kind: "retry" });
    expect(state.selection).toEqual([]);
  });
});

describe("quizReducer — hint", () => {
  it("records hint use on the result", () => {
    let state = reduce(initialQuizState(single), { kind: "revealHint" });
    state = reduce(state, { kind: "select", value: "b" });
    state = reduce(state, { kind: "submit" });
    expect(state.result).toMatchObject({ hintUsed: true });
  });

  it("stays revealed across a retry — a student who has seen it has seen it", () => {
    let state = reduce(initialQuizState(single), { kind: "revealHint" });
    state = reduce(state, { kind: "select", value: "a" });
    state = reduce(state, { kind: "submit" });
    state = reduce(state, { kind: "retry" });

    expect(state.hintUsed).toBe(true);

    state = reduce(state, { kind: "select", value: "b" });
    state = reduce(state, { kind: "submit" });
    expect(state.result).toMatchObject({ hintUsed: true, attempt: 2 });
  });

  it("is idempotent", () => {
    const revealed = reduce(initialQuizState(single), { kind: "revealHint" });
    expect(reduce(revealed, { kind: "revealHint" })).toBe(revealed);
  });
});

/*
 * COURSE-P4-04 — hydration from `quiz_attempts`.
 *
 * The rule that carries the most risk is the LAST one here: a restored result must be
 * marked `restored`, because the card reports every non-restored result to the
 * persistence layer. Miss it and every page load appends a duplicate attempt row.
 */

const history = (over: Partial<ExerciseAttemptHistory> = {}): ExerciseAttemptHistory => ({
  quizId:          "q-single",
  attempts:        2,
  solved:          true,
  lastCorrect:     true,
  lastAnswer:      { kind: "quiz", questionType: "single", value: "b", hintUsed: false, attempt: 2 },
  lastAttemptedAt: "2026-07-28T10:00:00.000Z",
  ...over,
});

describe("quizReducer — hydrate", () => {
  it("replays the stored answer, verdict and attempt count", () => {
    const state = reduce(initialQuizState(single), { kind: "hydrate", history: history() });

    expect(state.selection).toBe("b");
    expect(state.attempts).toBe(2);
    expect(state.result).toMatchObject({ correct: true, attempt: 2 });
    expect(state.lastAttemptedAt).toBe("2026-07-28T10:00:00.000Z");
    expect(state.previouslySolved).toBe(true);
  });

  it("marks the replayed result `restored` — the card must NOT report it", () => {
    const state = reduce(initialQuizState(single), { kind: "hydrate", history: history() });
    expect(state.restored).toBe(true);
  });

  it("re-grades against the CURRENT answer key rather than trusting the stored verdict", () => {
    // The row says they were right; the answer key has since been corrected to "b",
    // and "a" is now wrong. The honest verdict wins.
    const state = reduce(initialQuizState(single), {
      kind: "hydrate",
      history: history({
        lastCorrect: true,
        lastAnswer: { kind: "quiz", questionType: "single", value: "a", hintUsed: false, attempt: 1 },
      }),
    });

    expect(state.selection).toBe("a");
    expect(state.result).toMatchObject({ correct: false });
  });

  it("restores hint use, so the replayed result still says the hint was seen", () => {
    const state = reduce(initialQuizState(single), {
      kind: "hydrate",
      history: history({
        lastAnswer: { kind: "quiz", questionType: "single", value: "b", hintUsed: true, attempt: 2 },
      }),
    });

    expect(state.hintUsed).toBe(true);
    expect(state.result).toMatchObject({ hintUsed: true });
  });

  it("falls back to a badge when the stored answer no longer fits the question", () => {
    const state = reduce(initialQuizState(single), {
      kind: "hydrate",
      history: history({ lastAnswer: { kind: "quiz", questionType: "single", value: "deleted-option" } }),
    });

    // We know they answered and solved it; we cannot show what they answered.
    expect(state.attempts).toBe(2);
    expect(state.previouslySolved).toBe(true);
    expect(state.result).toBeNull();
    expect(state.selection).toBeNull();
    expect(state.restored).toBe(false);
  });

  it("NEVER overwrites an answer given in this session", () => {
    let state = reduce(initialQuizState(single), { kind: "select", value: "a" });
    state = reduce(state, { kind: "submit" });

    const after = reduce(state, { kind: "hydrate", history: history() });

    expect(after).toBe(state);
    expect(after.selection).toBe("a");
    expect(after.attempts).toBe(1);
  });

  it("ignores an empty history", () => {
    const initial = initialQuizState(single);
    expect(reduce(initial, { kind: "hydrate", history: history({ attempts: 0 }) })).toBe(initial);
  });

  it("continues the attempt count: a retry after two stored attempts is attempt 3", () => {
    let state = reduce(initialQuizState(single), { kind: "hydrate", history: history() });
    state = reduce(state, { kind: "retry" });

    expect(state.restored).toBe(false); // the replay is gone; the next result is theirs
    expect(state.attempts).toBe(2);

    state = reduce(state, { kind: "select", value: "b" });
    state = reduce(state, { kind: "submit" });

    expect(state.result).toMatchObject({ attempt: 3 });
    expect(state.restored).toBe(false);
  });

  it("keeps `previouslySolved` when a later attempt is wrong", () => {
    let state = reduce(initialQuizState(single), { kind: "hydrate", history: history() });
    state = reduce(state, { kind: "retry" });
    state = reduce(state, { kind: "select", value: "a" });
    state = reduce(state, { kind: "submit" });

    expect(state.result).toMatchObject({ correct: false });
    expect(state.previouslySolved).toBe(true);
  });
});
