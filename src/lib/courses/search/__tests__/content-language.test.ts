/**
 * COURSE-P9-02 — the three language states a search index can be in, and the empty edge.
 */

import { contentLanguage, isFallbackLesson } from "../content-language";

const lesson = (contentLocale: string) => ({ contentLocale });

describe("contentLanguage", () => {
  it("is native when every lesson is in the requested locale", () => {
    expect(contentLanguage({ locale: "en", lessons: [lesson("en"), lesson("en")] })).toBe("native");
  });

  it("is fallback when no lesson is in the requested locale", () => {
    expect(contentLanguage({ locale: "en", lessons: [lesson("es"), lesson("es")] })).toBe("fallback");
  });

  it("is partial when the course is translated lesson by lesson", () => {
    expect(contentLanguage({ locale: "en", lessons: [lesson("en"), lesson("es")] })).toBe("partial");
  });

  it("treats an empty index as native — there is nothing to warn about yet", () => {
    expect(contentLanguage({ locale: "en", lessons: [] })).toBe("native");
  });

  it("never fires for the canonical locale reading its own prose", () => {
    expect(contentLanguage({ locale: "es", lessons: [lesson("es"), lesson("es")] })).toBe("native");
  });
});

describe("isFallbackLesson", () => {
  it("marks a lesson whose prose is not in the requested locale", () => {
    expect(isFallbackLesson(lesson("es"), "en")).toBe(true);
    expect(isFallbackLesson(lesson("en"), "en")).toBe(false);
  });
});
