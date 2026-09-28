/*
 * BLOG-03 / COURSE-P12 — unit tests for the copyable-code text normalizer.
 *
 * `codeTextFromFigure` is DOM glue (exercised in the browser); the piece worth pinning
 * is `normalizeCopiedCode`, which decides what a paste looks like. This repo runs unit
 * tests in the node environment with no jsdom (see the quiz state test), so only the
 * pure string function is covered here.
 */

import { normalizeCopiedCode } from "../code-text";

describe("normalizeCopiedCode", () => {
  it("drops the trailing newline a fenced block leaves behind", () => {
    expect(normalizeCopiedCode("print(1)\n")).toBe("print(1)");
  });

  it("collapses several trailing newlines to none", () => {
    expect(normalizeCopiedCode("a\nb\n\n\n")).toBe("a\nb");
  });

  it("leaves code without a trailing newline untouched", () => {
    expect(normalizeCopiedCode("a\nb")).toBe("a\nb");
  });

  it("preserves interior blank lines", () => {
    expect(normalizeCopiedCode("a\n\nb\n")).toBe("a\n\nb");
  });

  it("does not strip trailing spaces on the last line, only newlines", () => {
    expect(normalizeCopiedCode("a\nb  \n")).toBe("a\nb  ");
  });

  it("returns an empty string for empty or newline-only input", () => {
    expect(normalizeCopiedCode("")).toBe("");
    expect(normalizeCopiedCode("\n\n")).toBe("");
  });
});
