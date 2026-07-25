// COURSE-P1-02 — Zod schema tests for the course manifest + lesson frontmatter.
//
// The load-bearing assertion here is `.strict()`: an unknown/typo'd key must be
// REJECTED, not silently dropped — that is the failure mode the registry exists to
// prevent (`mintues:` sailing through as valid).

import {
  CourseManifestSchema,
  LessonFrontmatterSchema,
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

  it("accepts a non-empty quiz array without inspecting its contents (P3-01 tightens it)", () => {
    const parsed = LessonFrontmatterSchema.parse({ ...valid, quiz: [{ anything: true }] });
    expect(parsed.quiz).toHaveLength(1);
  });

  it("rejects a non-array quiz", () => {
    expect(() => LessonFrontmatterSchema.parse({ ...valid, quiz: "no" })).toThrow();
  });
});
