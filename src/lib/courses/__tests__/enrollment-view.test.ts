// COURSE-P4-03 — enrolment summaries + registry metadata → panel rows.
//
// Two halves: `toEnrolledCourseViews` is pure and tested against a fake resolver,
// and `registryCourseMeta` is tested against a temp fixture tree via
// `__setContentRoot`, the same way registry.test.ts does it. The case that matters
// there is the locale fallback: a course with no `en` tree must still resolve for an
// English reader, in Spanish, instead of vanishing from the panel.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { CourseProgressSummary } from "@/domain/types";
import {
  registryCourseMeta,
  toEnrolledCourseViews,
  type CourseMeta,
  type CourseMetaResolver,
} from "@/lib/courses/enrollment-view";
import { __resetRegistry, __setContentRoot } from "@/lib/courses/registry";

// ─── toEnrolledCourseViews ────────────────────────────────────────────────────

function summary(over: Partial<CourseProgressSummary> = {}): CourseProgressSummary {
  return {
    courseSlug:         "dl-nlp",
    totalLessons:       10,
    completedLessons:   0,
    percentComplete:    0,
    lastSeenLessonSlug: null,
    enrolledAt:         "2026-01-01T00:00:00.000Z",
    completedAt:        null,
    ...over,
  };
}

const meta = (over: Partial<CourseMeta> = {}): CourseMeta => ({
  title:           "Deep Learning para NLP",
  firstLessonSlug: "intro",
  locale:          "es",
  ...over,
});

const resolverFor = (metas: Record<string, CourseMeta>): CourseMetaResolver =>
  (slug) => metas[slug] ?? null;

describe("toEnrolledCourseViews", () => {
  it("merges the title and resumes at the first lesson when nothing was seen", () => {
    const [view] = toEnrolledCourseViews(
      [summary()],
      resolverFor({ "dl-nlp": meta() }),
    );

    expect(view).toEqual({
      courseSlug:       "dl-nlp",
      title:            "Deep Learning para NLP",
      totalLessons:     10,
      completedLessons: 0,
      percentComplete:  0,
      resumeLessonSlug: "intro",
      completedAt:      null,
      contentLocale:    "es",
    });
  });

  it("resumes at the last seen lesson for a partially finished course", () => {
    const [view] = toEnrolledCourseViews(
      [summary({ completedLessons: 4, percentComplete: 40, lastSeenLessonSlug: "backprop" })],
      resolverFor({ "dl-nlp": meta() }),
    );

    expect(view.percentComplete).toBe(40);
    expect(view.completedLessons).toBe(4);
    expect(view.resumeLessonSlug).toBe("backprop");
    expect(view.completedAt).toBeNull();
  });

  it("carries completion through at 100%", () => {
    const [view] = toEnrolledCourseViews(
      [summary({
        completedLessons:   10,
        percentComplete:    100,
        lastSeenLessonSlug: "final",
        completedAt:        "2026-06-01T00:00:00.000Z",
      })],
      resolverFor({ "dl-nlp": meta() }),
    );

    expect(view.percentComplete).toBe(100);
    expect(view.completedAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("has no resume target when the course has no published lesson", () => {
    const [view] = toEnrolledCourseViews(
      [summary({ totalLessons: 0 })],
      resolverFor({ "dl-nlp": meta({ firstLessonSlug: null }) }),
    );

    expect(view.resumeLessonSlug).toBeNull();
  });

  it("skips a stale enrolment whose course is no longer in the registry", () => {
    const views = toEnrolledCourseViews(
      [summary({ courseSlug: "retirado" }), summary()],
      resolverFor({ "dl-nlp": meta() }),
    );

    expect(views.map((v) => v.courseSlug)).toEqual(["dl-nlp"]);
  });
});

// ─── registryCourseMeta ───────────────────────────────────────────────────────

const MANIFEST = (title: string) => `
slug: dl-nlp
title: "${title}"
tagline: "..."
level: intermedio
estimatedHours: 40
prerequisites: []
blocks:
  - id: 1
    title: "Bloque 1"
    summary: "..."
`;

function lessonFile(slug: string, order: number, draft = false): string {
  const fm = {
    title: `Lección ${slug}`,
    block: 1,
    order,
    minutes: 10,
    summary: "...",
    draft,
    hasCode: false,
    hasQuiz: false,
    quiz: [],
    challenges: [],
    reading: [],
    slug,
  };
  const yaml = Object.entries(fm)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");
  return `---\n${yaml}\n---\n\nCuerpo.\n`;
}

/** Temp content root with a Spanish `dl-nlp`, plus an English tree when asked. */
function makeTree(opts: { en?: boolean; esDraftOnly?: boolean } = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "enrollment-view-"));
  const courseDir = path.join(root, "dl-nlp");
  fs.mkdirSync(path.join(courseDir, "es"), { recursive: true });
  fs.writeFileSync(path.join(courseDir, "course.es.yml"), MANIFEST("Curso en español"));
  fs.writeFileSync(
    path.join(courseDir, "es", "00-intro.mdx"),
    lessonFile("intro", 1, opts.esDraftOnly === true),
  );
  fs.writeFileSync(path.join(courseDir, "es", "01-avanzado.mdx"), lessonFile("avanzado", 2, true));

  if (opts.en) {
    fs.mkdirSync(path.join(courseDir, "en"), { recursive: true });
    fs.writeFileSync(path.join(courseDir, "course.en.yml"), MANIFEST("Course in English"));
    fs.writeFileSync(path.join(courseDir, "en", "00-intro.mdx"), lessonFile("intro", 1));
  }
  return root;
}

afterEach(() => __resetRegistry());

describe("registryCourseMeta", () => {
  it("reads the title and first published lesson in the requested locale", () => {
    __setContentRoot(makeTree({ en: true }));

    expect(registryCourseMeta("en")("dl-nlp")).toEqual({
      title:           "Course in English",
      firstLessonSlug: "intro",
      locale:          "en",
    });
  });

  it("falls back to the default locale when the course has no tree for the request locale", () => {
    __setContentRoot(makeTree());

    expect(registryCourseMeta("en")("dl-nlp")).toEqual({
      title:           "Curso en español",
      firstLessonSlug: "intro",
      locale:          "es",
    });
  });

  it("reports no first lesson when every lesson is a draft", () => {
    __setContentRoot(makeTree({ esDraftOnly: true }));

    expect(registryCourseMeta("es")("dl-nlp")?.firstLessonSlug).toBeNull();
  });

  it("returns null for a slug the registry does not know", () => {
    __setContentRoot(makeTree());

    expect(registryCourseMeta("es")("retirado")).toBeNull();
    expect(registryCourseMeta("en")("retirado")).toBeNull();
  });
});
