/*
 * COURSE-P5-00 — Tests for the on-this-page scroll-spy.
 *
 * The case that matters is the first one: above the first heading, nothing is active.
 * The previous implementation fell back to `headings[0]`, which lit up section one
 * while the reader was still in the untitled opening prose that every lesson in this
 * course starts with.
 */

import { activeHeadingId } from "../scroll-spy";

const OFFSET = 100;

describe("activeHeadingId", () => {
  it("is null while the reader is above the first heading", () => {
    // Every heading still below the reading line — i.e. the untitled introduction.
    const positions = [
      { id: "a", top: 400 },
      { id: "b", top: 900 },
    ];
    expect(activeHeadingId(positions, OFFSET)).toBeNull();
  });

  it("is null when the first heading is just below the reading line", () => {
    expect(activeHeadingId([{ id: "a", top: OFFSET + 1 }], OFFSET)).toBeNull();
  });

  it("activates a heading exactly as it reaches the reading line", () => {
    expect(activeHeadingId([{ id: "a", top: OFFSET }], OFFSET)).toBe("a");
  });

  it("picks the LAST heading that has crossed, not the first", () => {
    const positions = [
      { id: "a", top: -800 },
      { id: "b", top: -200 },
      { id: "c", top: 600 },
    ];
    expect(activeHeadingId(positions, OFFSET)).toBe("b");
  });

  it("holds the last heading once every one has been scrolled past", () => {
    const positions = [
      { id: "a", top: -1200 },
      { id: "b", top: -700 },
      { id: "c", top: -100 },
    ];
    expect(activeHeadingId(positions, OFFSET)).toBe("c");
  });

  it("handles a lesson with a single heading, both sides of the line", () => {
    expect(activeHeadingId([{ id: "only", top: 300 }], OFFSET)).toBeNull();
    expect(activeHeadingId([{ id: "only", top: -5 }], OFFSET)).toBe("only");
  });

  it("is null for a lesson with no headings at all", () => {
    expect(activeHeadingId([], OFFSET)).toBeNull();
  });

  it("stops at the first heading that has not crossed — document order is assumed", () => {
    // `c` is above the line but sits after an uncrossed `b`; it must not win.
    const positions = [
      { id: "a", top: -300 },
      { id: "b", top: 500 },
      { id: "c", top: -50 },
    ];
    expect(activeHeadingId(positions, OFFSET)).toBe("a");
  });
});
