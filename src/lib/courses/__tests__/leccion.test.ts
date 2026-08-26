/*
 * COURSE-P7-01 — Tests for the rule that decides whether a reference links.
 *
 * `isAhead` is the whole of "nothing here is authored": the author writes a slug, and
 * where the target sits in the (block, order) spine decides how it renders. Get the
 * comparison wrong and forward references start linking from inside the bridge — the one
 * place the phase deliberately keeps quiet, because `LessonNav` is already there.
 *
 * Only the pure helper is exercised. The component around it is an async Server Component
 * that reads the registry and next-intl's request context; it is verified in the browser
 * and by the pipeline fixture, not here.
 */

import { isAhead } from "../Leccion";

describe("isAhead", () => {
  it("is true for a later lesson in the same block", () => {
    expect(isAhead({ block: 2, order: 3 }, { block: 2, order: 4 })).toBe(true);
  });

  it("is false for an earlier lesson in the same block", () => {
    expect(isAhead({ block: 2, order: 3 }, { block: 2, order: 2 })).toBe(false);
  });

  it("is false for the lesson itself", () => {
    expect(isAhead({ block: 2, order: 3 }, { block: 2, order: 3 })).toBe(false);
  });

  it("is true for any lesson in a later block, whatever its order", () => {
    expect(isAhead({ block: 2, order: 9 }, { block: 3, order: 1 })).toBe(true);
  });

  it("is false for any lesson in an earlier block, whatever its order", () => {
    // The trap a bare `order` comparison falls into: lesson 1 of block 3 comes AFTER
    // lesson 9 of block 2, and lesson 9 of block 1 comes before it.
    expect(isAhead({ block: 2, order: 1 }, { block: 1, order: 9 })).toBe(false);
  });
});
