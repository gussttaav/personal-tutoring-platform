// COURSE-P1-02 — Registry tests against a temp fixture tree.
//
// The registry reads the filesystem, so these build a throwaway course tree under
// `os.tmpdir()` and point the public API at it via `__setContentRoot`. This is the
// first fs/temp-dir test in the repo; keep it self-contained (each `it` builds its
// own tree so there is no cross-test coupling and no memo leakage).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildRegistry,
  getCourse,
  getLesson,
  listCourses,
  listLessons,
  lessonNeighbours,
  __setContentRoot,
  __resetRegistry,
} from "@/lib/courses/registry";

// ─── fixture-tree helpers ─────────────────────────────────────────────────────

const MANIFEST = `
slug: dl-nlp
title: "Curso"
tagline: "..."
level: intermedio
estimatedHours: 40
prerequisites: []
blocks:
  - id: 0
    title: "Bloque 0"
    summary: "..."
  - id: 1
    title: "Bloque 1"
    summary: "..."
`;

interface LessonFm {
  slug: string;
  title?: string;
  block?: number;
  order?: number;
  minutes?: number;
  summary?: string;
  draft?: boolean;
  hasCode?: boolean;
  hasQuiz?: boolean;
  quiz?: unknown[];
}

function lessonFile(fm: LessonFm): string {
  const full = {
    title: `Lección ${fm.slug}`,
    block: 0,
    order: 1,
    minutes: 10,
    summary: "...",
    draft: false,
    hasCode: false,
    hasQuiz: false,
    quiz: [],
    ...fm,
  };
  const yaml = Object.entries(full)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");
  return `---\n${yaml}\n---\n\nCuerpo de la lección.\n`;
}

/** Create a temp content root with one `dl-nlp` course, `es` locale + given lessons. */
function makeTree(opts: {
  manifest?: string;
  lessons?: { filename: string; fm: LessonFm }[];
  withEsDir?: boolean;
}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "courses-"));
  const courseDir = path.join(root, "dl-nlp");
  fs.mkdirSync(courseDir, { recursive: true });
  fs.writeFileSync(path.join(courseDir, "course.es.yml"), opts.manifest ?? MANIFEST);

  if (opts.withEsDir !== false) {
    const esDir = path.join(courseDir, "es");
    fs.mkdirSync(esDir, { recursive: true });
    for (const { filename, fm } of opts.lessons ?? []) {
      fs.writeFileSync(path.join(esDir, filename), lessonFile(fm));
    }
  }
  return root;
}

afterEach(() => __resetRegistry());

// ─── valid course ─────────────────────────────────────────────────────────────

describe("valid course", () => {
  it("parses the manifest and lessons", () => {
    const root = makeTree({
      lessons: [
        { filename: "00-intro.mdx", fm: { slug: "intro", order: 1 } },
        { filename: "01-avanzado.mdx", fm: { slug: "avanzado", order: 2 } },
      ],
    });
    __setContentRoot(root);

    const course = getCourse("dl-nlp", "es");
    expect(course?.title).toBe("Curso");
    expect(course?.blocks).toHaveLength(2);

    expect(listCourses("es").map((c) => c.slug)).toEqual(["dl-nlp"]);
    expect(listLessons("dl-nlp", "es").map((l) => l.slug)).toEqual(["intro", "avanzado"]);
    expect(getLesson("dl-nlp", "intro", "es")?.title).toBe("Lección intro");
    expect(getLesson("dl-nlp", "missing", "es")).toBeNull();
    expect(getCourse("nope", "es")).toBeNull();
  });

  it("sorts lessons by (block, order), not by filename", () => {
    const root = makeTree({
      lessons: [
        { filename: "00-b.mdx", fm: { slug: "b", block: 1, order: 1 } },
        { filename: "01-a.mdx", fm: { slug: "a", block: 0, order: 5 } },
        { filename: "02-c.mdx", fm: { slug: "c", block: 0, order: 1 } },
      ],
    });
    __setContentRoot(root);
    // (block,order): c(0,1) → a(0,5) → b(1,1)
    expect(listLessons("dl-nlp", "es").map((l) => l.slug)).toEqual(["c", "a", "b"]);
  });
});

// ─── build-time failures ──────────────────────────────────────────────────────

describe("build-time validation failures", () => {
  it("throws naming the file on bad frontmatter (typo'd key rejected by strict)", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "courses-"));
    const esDir = path.join(root, "dl-nlp", "es");
    fs.mkdirSync(esDir, { recursive: true });
    fs.writeFileSync(path.join(root, "dl-nlp", "course.es.yml"), MANIFEST);
    // `mintues:` typo + missing `minutes` — strict schema must reject.
    fs.writeFileSync(
      path.join(esDir, "00-intro.mdx"),
      `---\nslug: intro\ntitle: "x"\nblock: 0\norder: 1\nmintues: 5\nsummary: "y"\ndraft: false\nhasCode: false\nhasQuiz: false\nquiz: []\n---\n`,
    );

    expect(() => buildRegistry(root, "es")).toThrow(/00-intro\.mdx/);
  });

  it("throws on a duplicate lesson slug within a course", () => {
    const root = makeTree({
      lessons: [
        { filename: "00-intro.mdx", fm: { slug: "intro" } },
        { filename: "01-intro.mdx", fm: { slug: "intro" } },
      ],
    });
    expect(() => buildRegistry(root, "es")).toThrow(/duplicate lesson slug "intro"/);
  });

  it("throws on a block id not declared in the manifest", () => {
    const root = makeTree({
      lessons: [{ filename: "00-intro.mdx", fm: { slug: "intro", block: 7 } }],
    });
    expect(() => buildRegistry(root, "es")).toThrow(/block 7 is not declared/);
  });

  it("throws on an orphan file whose slug != filename stem", () => {
    const root = makeTree({
      lessons: [{ filename: "00-intro.mdx", fm: { slug: "otra-cosa" } }],
    });
    expect(() => buildRegistry(root, "es")).toThrow(/does not match filename stem "intro"/);
  });
});

// ─── drafts + missing locale ──────────────────────────────────────────────────

describe("publication + empty-locale handling", () => {
  it("never returns draft lessons from list*", () => {
    const root = makeTree({
      lessons: [
        { filename: "00-a.mdx", fm: { slug: "a", order: 1 } },
        { filename: "01-borrador.mdx", fm: { slug: "borrador", order: 2, draft: true } },
        { filename: "02-c.mdx", fm: { slug: "c", order: 3 } },
      ],
    });
    __setContentRoot(root);
    expect(listLessons("dl-nlp", "es").map((l) => l.slug)).toEqual(["a", "c"]);
    // getLesson is a point lookup and still finds the draft (routing decides visibility).
    expect(getLesson("dl-nlp", "borrador", "es")?.draft).toBe(true);
  });

  it("returns [] for a locale with no content instead of throwing", () => {
    const root = makeTree({
      lessons: [{ filename: "00-a.mdx", fm: { slug: "a" } }],
    });
    __setContentRoot(root);
    // `en` has no manifest/dir — the normal state for months.
    expect(listCourses("en")).toEqual([]);
    expect(listLessons("dl-nlp", "en")).toEqual([]);
    expect(getCourse("dl-nlp", "en")).toBeNull();
  });

  it("returns [] when the content root itself is absent", () => {
    __setContentRoot(path.join(os.tmpdir(), "does-not-exist-courses-xyz"));
    expect(listCourses("es")).toEqual([]);
  });
});

// ─── neighbours ───────────────────────────────────────────────────────────────

describe("lessonNeighbours", () => {
  it("returns null at both ends and links the middle", () => {
    const root = makeTree({
      lessons: [
        { filename: "00-a.mdx", fm: { slug: "a", order: 1 } },
        { filename: "01-b.mdx", fm: { slug: "b", order: 2 } },
        { filename: "02-c.mdx", fm: { slug: "c", order: 3 } },
      ],
    });
    __setContentRoot(root);

    expect(lessonNeighbours("dl-nlp", "a", "es")).toEqual({
      prev: null,
      next: { slug: "b", title: "Lección b" },
    });
    expect(lessonNeighbours("dl-nlp", "b", "es")).toEqual({
      prev: { slug: "a", title: "Lección a" },
      next: { slug: "c", title: "Lección c" },
    });
    expect(lessonNeighbours("dl-nlp", "c", "es")).toEqual({
      prev: { slug: "b", title: "Lección b" },
      next: null,
    });
  });

  it("skips drafts and returns null for a draft/unknown lesson", () => {
    const root = makeTree({
      lessons: [
        { filename: "00-a.mdx", fm: { slug: "a", order: 1 } },
        { filename: "01-d.mdx", fm: { slug: "d", order: 2, draft: true } },
        { filename: "02-c.mdx", fm: { slug: "c", order: 3 } },
      ],
    });
    __setContentRoot(root);

    // The draft between a and c is skipped: a's next is c.
    expect(lessonNeighbours("dl-nlp", "a", "es").next).toEqual({ slug: "c", title: "Lección c" });
    // A draft (not in the published list) has no neighbours.
    expect(lessonNeighbours("dl-nlp", "d", "es")).toEqual({ prev: null, next: null });
    expect(lessonNeighbours("dl-nlp", "unknown", "es")).toEqual({ prev: null, next: null });
  });
});

// ─── memoization ──────────────────────────────────────────────────────────────

describe("memoization", () => {
  it("does not re-read the filesystem after the first build", () => {
    const root = makeTree({
      lessons: [{ filename: "00-a.mdx", fm: { slug: "a" } }],
    });
    __setContentRoot(root);

    // First call builds + caches.
    expect(listCourses("es").map((c) => c.slug)).toEqual(["dl-nlp"]);

    // Delete the whole tree; a re-read would now return [].
    fs.rmSync(root, { recursive: true, force: true });

    // Still served from the memo → proves no second filesystem read.
    expect(listCourses("es").map((c) => c.slug)).toEqual(["dl-nlp"]);
  });
});
