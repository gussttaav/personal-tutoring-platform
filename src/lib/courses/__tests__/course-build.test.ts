// COURSE-BUILD-01 — `courseBuildStatus`: every block, measured against its plan.
//
// Two halves, deliberately:
//
//  1. A registry fixture (the temp-tree pattern from ./registry.test.ts) feeding real
//     `listLessons` output through the grouper. This is inherited from the old
//     `groupLessonsByBlock` suite in src/features/courses/landing/__tests__, and its
//     load-bearing case is now INVERTED: a block whose lessons are all drafts used to have to
//     be OMITTED ("not rendered empty-but-present") and must now come back as `upcoming`. That
//     reversal is the whole feature — a course written in public has to be able to advertise
//     the blocks nobody has written yet — so it is pinned from the same fixture that pinned
//     the old rule. These cases also prove the YAML `lessons:` key survives CourseManifestSchema.
//
//  2. Pure cases for the plan arithmetic, built straight from literals. No filesystem needed:
//     `courseBuildStatus` takes blocks + lessons and nothing else, which is the point of it
//     living in `src/lib/courses/` rather than inside the accordion.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { CourseBlock, Lesson } from "@/domain/types";
import { courseBuildStatus } from "@/lib/courses/course-build";
import { getCourse, listLessons, __setContentRoot, __resetRegistry } from "@/lib/courses/registry";

// Three declared blocks (1, 2, 3) so we can leave block 2 all-drafts. Block 1 declares a plan
// of three lessons; block 3 declares none, so both branches of `planned` are exercised.
const MANIFEST = `
slug: dl-nlp
title: "Curso"
tagline: "..."
level: intermedio
prerequisites:
  intro: "..."
  items: []
cta:
  heading: "..."
  body: "..."
faq: []
blocks:
  - id: 1
    title: "Bloque 1"
    summary: "Resumen 1"
    lessons: 3
  - id: 2
    title: "Bloque 2"
    summary: "Resumen 2"
    lessons: 2
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "course-build-"));
  const esDir = path.join(root, "dl-nlp", "es");
  fs.mkdirSync(esDir, { recursive: true });
  fs.writeFileSync(path.join(root, "dl-nlp", "course.es.yml"), MANIFEST);
  for (const { filename, fm } of lessons) {
    fs.writeFileSync(path.join(esDir, filename), lessonFile(fm));
  }
  return root;
}

/** A published lesson, for the pure cases. */
function lesson(slug: string, block: number, order: number, minutes = 10): Lesson {
  return {
    slug, title: slug, block, order, minutes,
    summary: "...", draft: false, hasCode: false, hasQuiz: false,
    quiz: [], challenges: [], reading: [],
  };
}

const block = (id: number, lessons?: number): CourseBlock => ({
  id, title: `Bloque ${id}`, summary: `Resumen ${id}`, lessons,
});

afterEach(() => __resetRegistry());

describe("courseBuildStatus — against the registry", () => {
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
    const status = courseBuildStatus(course.blocks, listLessons("dl-nlp", "es"));

    // Every block is present now — block 2 included, with nothing in it.
    expect(status.blocks.map((b) => b.block.id)).toEqual([1, 2, 3]);
    expect(status.blocks[0].lessons.map((l) => l.slug)).toEqual(["a", "b"]);
    expect(status.blocks[0].totalMinutes).toBe(25);
    expect(status.blocks[2].lessons.map((l) => l.slug)).toEqual(["c"]);
    expect(status.blocks[2].totalMinutes).toBe(20);
    expect(status.publishedBlocks).toBe(2);
    expect(status.totalBlocks).toBe(3);
    expect(status.publishedLessons).toBe(3);
  });

  it("reads the manifest's `lessons` plan — so the YAML key reaches the status", () => {
    const root = makeTree([{ filename: "00-a.mdx", fm: { slug: "a", block: 1, order: 1 } }]);
    __setContentRoot(root);

    const course = getCourse("dl-nlp", "es")!;
    const status = courseBuildStatus(course.blocks, listLessons("dl-nlp", "es"));

    expect(status.blocks[0].planned).toBe(3);   // declared
    expect(status.blocks[1].planned).toBe(2);   // declared, nothing published
    expect(status.blocks[2].planned).toBe(0);   // not declared, nothing published
    // Block 3 declares no plan, so the total is unknowable rather than 5.
    expect(status.plannedLessons).toBeNull();
  });

  it("reports a block whose lessons are all drafts as upcoming, NOT omitted", () => {
    const root = makeTree([
      { filename: "00-a.mdx", fm: { slug: "a", block: 1, order: 1, minutes: 10 } },
      // block 2: only drafts → listLessons drops them → the block is upcoming, still rendered
      { filename: "01-d1.mdx", fm: { slug: "d1", block: 2, order: 1, draft: true } },
      { filename: "02-d2.mdx", fm: { slug: "d2", block: 2, order: 2, draft: true } },
      { filename: "03-c.mdx", fm: { slug: "c", block: 3, order: 1, minutes: 5 } },
    ]);
    __setContentRoot(root);

    const course = getCourse("dl-nlp", "es")!;
    const status = courseBuildStatus(course.blocks, listLessons("dl-nlp", "es"));

    const b2 = status.blocks.find((b) => b.block.id === 2)!;
    expect(b2.state).toBe("upcoming");
    expect(b2.lessons).toEqual([]);
    expect(b2.published).toBe(0);
    // Its title and summary are what the landing page renders, so they have to survive.
    expect(b2.block.title).toBe("Bloque 2");
    expect(b2.block.summary).toBe("Resumen 2");
    expect(status.publishedBlocks).toBe(2);
    expect(status.complete).toBe(false);
  });

  it("treats a course with no published lessons as entirely upcoming", () => {
    const root = makeTree([{ filename: "00-a.mdx", fm: { slug: "a", draft: true } }]);
    __setContentRoot(root);

    const course = getCourse("dl-nlp", "es")!;
    const status = courseBuildStatus(course.blocks, listLessons("dl-nlp", "es"));

    expect(status.blocks).toHaveLength(3);
    expect(status.blocks.every((b) => b.state === "upcoming")).toBe(true);
    expect(status.publishedBlocks).toBe(0);
    expect(status.publishedLessons).toBe(0);
    expect(status.complete).toBe(false);
  });
});

describe("courseBuildStatus — the plan arithmetic", () => {
  it("is partial while a block is short of its plan and complete once it reaches it", () => {
    const blocks = [block(1, 3)];
    expect(courseBuildStatus(blocks, [lesson("a", 1, 1)]).blocks[0].state).toBe("partial");
    expect(
      courseBuildStatus(blocks, [lesson("a", 1, 1), lesson("b", 1, 2)]).blocks[0].state,
    ).toBe("partial");
    expect(
      courseBuildStatus(blocks, [lesson("a", 1, 1), lesson("b", 1, 2), lesson("c", 1, 3)])
        .blocks[0].state,
    ).toBe("complete");
  });

  it("stays complete past the plan — a block may grow beyond what was planned", () => {
    const status = courseBuildStatus(
      [block(1, 2)],
      [lesson("a", 1, 1), lesson("b", 1, 2), lesson("c", 1, 3)],
    );
    expect(status.blocks[0].state).toBe("complete");
    expect(status.complete).toBe(true);
  });

  it("counts a block with no declared plan as complete once it has a lesson", () => {
    // This is what keeps a course finished before the key existed (dl-nlp) reading unchanged.
    const status = courseBuildStatus([block(1), block(2)], [lesson("a", 1, 1), lesson("b", 2, 1)]);
    expect(status.blocks.map((b) => b.state)).toEqual(["complete", "complete"]);
    expect(status.complete).toBe(true);
    expect(status.plannedLessons).toBeNull();
  });

  it("is complete only when EVERY block is", () => {
    const lessons = [lesson("a", 1, 1), lesson("b", 2, 1)];
    expect(courseBuildStatus([block(1, 1), block(2, 1)], lessons).complete).toBe(true);
    // One block short of its plan is enough to hold the whole course open.
    expect(courseBuildStatus([block(1, 1), block(2, 2)], lessons).complete).toBe(false);
    // So is one block with nothing in it.
    expect(courseBuildStatus([block(1, 1), block(2, 1), block(3, 4)], lessons).complete).toBe(false);
  });

  it("sums the planned total only when every block declares one", () => {
    expect(courseBuildStatus([block(1, 9), block(2, 8)], []).plannedLessons).toBe(17);
    expect(courseBuildStatus([block(1, 9), block(2)], []).plannedLessons).toBeNull();
  });
});
