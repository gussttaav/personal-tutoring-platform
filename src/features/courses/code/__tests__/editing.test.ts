/*
 * COURSE-P2-03 — Tests for the code cell's editor keystrokes.
 *
 * These matter more than they look. The cell is a plain <textarea>, and in Python
 * indentation is syntax: a Tab that inserts a literal tab, or an Enter that drops
 * back to column 0 inside a loop body, produces an IndentationError the student did
 * not write and cannot see. The helpers are pure so every edge (dedent at column 0,
 * multi-line selection, quote inside a word) is checked here rather than by hand.
 */

import {
  INDENT,
  applyAutoClose,
  applyBackspacePair,
  applyEnter,
  applyTab,
} from "../editing";

/** Write the caret as "|" and a selection as "[...]" for readability. */
function at(value: string, start: number, end: number = start) {
  return { value, selectionStart: start, selectionEnd: end };
}

describe("applyTab", () => {
  it("inserts one indent level at the caret", () => {
    expect(applyTab(at("x = 1", 0), false)).toEqual({
      value: `${INDENT}x = 1`,
      selectionStart: 4,
      selectionEnd: 4,
    });
  });

  it("replaces a single-line selection with the indent", () => {
    expect(applyTab(at("abc", 0, 3), false)).toEqual({
      value: INDENT,
      selectionStart: 4,
      selectionEnd: 4,
    });
  });

  it("indents every line of a multi-line selection", () => {
    const source = "a = 1\nb = 2";
    const result = applyTab(at(source, 0, source.length), false);
    expect(result?.value).toBe(`${INDENT}a = 1\n${INDENT}b = 2`);
  });

  it("leaves blank lines inside a selection alone", () => {
    const source = "a = 1\n\nb = 2";
    const result = applyTab(at(source, 0, source.length), false);
    expect(result?.value).toBe(`${INDENT}a = 1\n\n${INDENT}b = 2`);
  });

  it("dedents by one level on Shift+Tab", () => {
    const source = `${INDENT}a = 1\n${INDENT}b = 2`;
    const result = applyTab(at(source, 0, source.length), true);
    expect(result?.value).toBe("a = 1\nb = 2");
  });

  it("removes only the spaces that are there when dedenting a short indent", () => {
    const result = applyTab(at("  a = 1", 0, 7), true);
    expect(result?.value).toBe("a = 1");
  });

  it("returns null when there is nothing left to dedent", () => {
    expect(applyTab(at("a = 1", 0, 5), true)).toBeNull();
  });
});

describe("applyEnter", () => {
  it("carries the current indentation to the new line", () => {
    const source = `${INDENT}total = 0`;
    const result = applyEnter(at(source, source.length));
    expect(result?.value).toBe(`${INDENT}total = 0\n${INDENT}`);
  });

  it("adds a level after a line ending in a colon", () => {
    const source = "for i in range(3):";
    const result = applyEnter(at(source, source.length));
    expect(result?.value).toBe(`for i in range(3):\n${INDENT}`);
  });

  it("adds a level after a colon with trailing whitespace", () => {
    const source = "def f():  ";
    const result = applyEnter(at(source, source.length));
    expect(result?.value).toBe(`def f():  \n${INDENT}`);
  });

  it("indents relative to an already-indented block opener", () => {
    const source = `${INDENT}if x:`;
    const result = applyEnter(at(source, source.length));
    expect(result?.value).toBe(`${INDENT}if x:\n${INDENT}${INDENT}`);
  });

  it("defers to the browser at column 0 with no colon", () => {
    expect(applyEnter(at("x = 1", 5))).toBeNull();
  });
});

describe("applyAutoClose", () => {
  it("closes a bracket and leaves the caret inside", () => {
    expect(applyAutoClose(at("f", 1), "(")).toEqual({
      value: "f()",
      selectionStart: 2,
      selectionEnd: 2,
    });
  });

  it("wraps a selection rather than replacing it", () => {
    expect(applyAutoClose(at("abc", 0, 3), "(")).toEqual({
      value: "(abc)",
      selectionStart: 1,
      selectionEnd: 4,
    });
  });

  it("types through a closer it already inserted instead of doubling it", () => {
    expect(applyAutoClose(at("f()", 2), ")")).toEqual({
      value: "f()",
      selectionStart: 3,
      selectionEnd: 3,
    });
  });

  it("does not auto-close a quote inside a word", () => {
    expect(applyAutoClose(at("don", 3), "'")).toBeNull();
  });

  it("does auto-close a quote at the start of a token", () => {
    expect(applyAutoClose(at("x = ", 4), '"')).toEqual({
      value: 'x = ""',
      selectionStart: 5,
      selectionEnd: 5,
    });
  });

  it("ignores characters that are not part of a pair", () => {
    expect(applyAutoClose(at("x", 1), "y")).toBeNull();
  });
});

describe("applyBackspacePair", () => {
  it("deletes both halves of an empty pair", () => {
    expect(applyBackspacePair(at("f()", 2))).toEqual({
      value: "f",
      selectionStart: 1,
      selectionEnd: 1,
    });
  });

  it("leaves a non-empty pair to the browser", () => {
    expect(applyBackspacePair(at("f(x)", 3))).toBeNull();
  });

  it("does nothing at the start of the document", () => {
    expect(applyBackspacePair(at("()", 0))).toBeNull();
  });

  it("does nothing when there is a selection", () => {
    expect(applyBackspacePair(at("()", 0, 2))).toBeNull();
  });
});
