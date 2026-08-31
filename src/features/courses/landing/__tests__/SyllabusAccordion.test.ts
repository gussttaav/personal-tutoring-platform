// COURSE-P1-03 — `groupLessonsByBlock` grouping/ordering, driven off a registry fixture.
//
// Follows the temp-fixture pattern from src/lib/courses/__tests__/registry.test.ts: build a
// throwaway course tree under os.tmpdir(), point the registry at it, and feed the PUBLISHED
// lessons (listLessons already drops drafts + sorts by (block, order)) into the pure grouper.
// The load-bearing case: a block whose lessons are ALL drafts must be omitted, not rendered
// empty-but-present.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { getCourse, listLessons, __setContentRoot, __resetRegistry } from "@/lib/courses/registry";
import { formatBlockDuration, groupLessonsByBlock } from "@/features/courses/landing/SyllabusAccordion";

// Three declared blocks (1, 2, 3) so we can leave block 2 all-drafts.
const MANIFEST = `
slug: dl-nlp
title: "Curso"
tagline: "..."
level: intermedio
prerequisites: []
blocks:
  - id: 1
    title: "Bloque 1"
    summary: "Resumen 1"
  - id: 2
    title: "Bloque 2"
    summary: "Resumen 2"
  - id: 3
    title: "Bloque 3"
    summary: "Resumen 3"
`;

interface LessonFm {
  slug: string;
  title?: string;
  block?: number;
  order?: number;
  minutes?: number;
  draft?: boolean;
}

function lessonFile(fm: LessonFm): string {
  const full = {
    title: `Lección ${fm.slug}`,
    block: 1,
    order: 1,
    minutes: 10,
    summary: "...",
    draft: false,
    hasCode: false,
    hasQuiz: false,
    quiz: [],
    challenges: [],
    reading: [],
    ...fm,
  };
  const yaml = Object.entries(full)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");
  return `---\n${yaml}\n---\n\nCuerpo.\n`;
}

function makeTree(lessons: { filename: string; fm: LessonFm }[]): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "syllabus-"));
  const esDir = path.join(root, "dl-nlp", "es");
  fs.mkdirSync(esDir, { recursive: true });
  fs.writeFileSync(path.join(root, "dl-nlp", "course.es.yml"), MANIFEST);
  for (const { filename, fm } of lessons) {
    fs.writeFileSync(path.join(esDir, filename), lessonFile(fm));
  }
  return root;
}

afterEach(() => __resetRegistry());

describe("groupLessonsByBlock", () => {
  it("groups published lessons under their manifest block, ordered, with block totals", () => {
    const root = makeTree([
      // block 1: two published lessons, given out of order to prove (block, order) sorting
      { filename: "00-b.mdx", fm: { slug: "b", block: 1, order: 2, minutes: 15 } },
      { filename: "01-a.mdx", fm: { slug: "a", block: 1, order: 1, minutes: 10 } },
      // block 3: one published lesson
      { filename: "02-c.mdx", fm: { slug: "c", block: 3, order: 1, minutes: 20 } },
    ]);
    __setContentRoot(root);

    const course = getCourse("dl-nlp", "es")!;
    const groups = groupLessonsByBlock(course, listLessons("dl-nlp", "es"));

    expect(groups.map((g) => g.block.id)).toEqual([1, 3]);
    expect(groups[0].lessons.map((l) => l.slug)).toEqual(["a", "b"]);
    expect(groups[0].totalMinutes).toBe(25);
    expect(groups[1].lessons.map((l) => l.slug)).toEqual(["c"]);
    expect(groups[1].totalMinutes).toBe(20);
  });

  it("omits a block whose lessons are all drafts (not rendered empty-but-present)", () => {
    const root = makeTree([
      { filename: "00-a.mdx", fm: { slug: "a", block: 1, order: 1, minutes: 10 } },
      // block 2: only drafts → listLessons drops them → block must be omitted
      { filename: "01-d1.mdx", fm: { slug: "d1", block: 2, order: 1, draft: true } },
      { filename: "02-d2.mdx", fm: { slug: "d2", block: 2, order: 2, draft: true } },
      { filename: "03-c.mdx", fm: { slug: "c", block: 3, order: 1, minutes: 5 } },
    ]);
    __setContentRoot(root);

    const course = getCourse("dl-nlp", "es")!;
    const groups = groupLessonsByBlock(course, listLessons("dl-nlp", "es"));

    // Block 2 has two declared positions but zero published lessons → absent.
    expect(groups.map((g) => g.block.id)).toEqual([1, 3]);
    expect(groups.some((g) => g.block.id === 2)).toBe(false);
  });

  it("returns an empty array when the course has no published lessons", () => {
    const root = makeTree([{ filename: "00-a.mdx", fm: { slug: "a", draft: true } }]);
    __setContentRoot(root);

    const course = getCourse("dl-nlp", "es")!;
    expect(groupLessonsByBlock(course, listLessons("dl-nlp", "es"))).toEqual([]);
  });
});

describe("formatBlockDuration", () => {
  it("keeps totals under an hour in minutes", () => {
    expect(formatBlockDuration(0)).toEqual({ kind: "minutes", minutes: 0 });
    expect(formatBlockDuration(48)).toEqual({ kind: "minutes", minutes: 48 });
    expect(formatBlockDuration(59)).toEqual({ kind: "minutes", minutes: 59 });
  });

  it("splits totals of an hour or more into hours + minutes", () => {
    expect(formatBlockDuration(60)).toEqual({ kind: "hours", hours: 1, minutes: 0 });
    expect(formatBlockDuration(168)).toEqual({ kind: "hours", hours: 2, minutes: 48 });
    expect(formatBlockDuration(125)).toEqual({ kind: "hours", hours: 2, minutes: 5 });
  });
});
