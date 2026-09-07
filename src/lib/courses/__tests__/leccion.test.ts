/*
 * COURSE-P7-01 — Tests for the rule that decides whether a reference links.
 *
 * `isAhead` is the whole of "nothing here is authored": the author writes a slug, and
 * where the target sits in the (block, order) spine decides how it renders. Get the
 * comparison wrong and forward references start linking from inside the bridge — the one
 * place the phase deliberately keeps quiet, because `LessonNav` is already there.
 *
 * Only the pure helpers are exercised. The component around them is an async Server
 * Component that reads next-intl's request context; it is verified in the browser and by
 * the pipeline fixture, not here.
 *
 * COURSE-P11-01 — `resolveTarget` is the second helper, and it carries the other half of
 * "nothing here is authored": WHICH tree a slug resolves in. On a translated lesson under
 * `/en` most targets are still Spanish-only, and resolving them in the English tree alone
 * returns null — no link, no card, no error. Its cases run against a temp fixture tree,
 * the same `__setContentRoot` arrangement `catalog-view.test.ts` uses.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { __resetRegistry, __setContentRoot } from "@/lib/courses/registry";

import { isAhead, resolveTarget } from "../Leccion";

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

// ─── COURSE-P11-01 — per-reference locale resolution ──────────────────────────

function manifest(title: string): string {
  return `
slug: dl-nlp
title: ${JSON.stringify(title)}
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
    summary: "..."
  - id: 2
    title: "Bloque 2"
    summary: "..."
`;
}

interface LessonSpec {
  slug:   string;
  title:  string;
  block?: number;
  order:  number;
  draft?: boolean;
}

function lessonFile(spec: LessonSpec): string {
  const fm = {
    slug: spec.slug, title: spec.title, block: spec.block ?? 1, order: spec.order,
    minutes: 10, summary: `Summary of ${spec.slug}`, draft: spec.draft ?? false,
    hasCode: false, hasQuiz: false, quiz: [], challenges: [], reading: [],
  };
  const yaml = Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n");
  return `---\n${yaml}\n---\n\nCuerpo.\n`;
}

/** A `dl-nlp` course with both manifests and the given lessons per locale. */
function makeTree(lessons: Record<string, LessonSpec[]>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "leccion-resolve-"));
  const courseDir = path.join(root, "dl-nlp");
  fs.mkdirSync(courseDir, { recursive: true });
  fs.writeFileSync(path.join(courseDir, "course.es.yml"), manifest("Curso"));
  fs.writeFileSync(path.join(courseDir, "course.en.yml"), manifest("Course"));

  for (const [locale, specs] of Object.entries(lessons)) {
    const dir = path.join(courseDir, locale);
    fs.mkdirSync(dir, { recursive: true });
    for (const spec of specs) {
      fs.writeFileSync(path.join(dir, `0${spec.order}-${spec.slug}.mdx`), lessonFile(spec));
    }
  }
  return root;
}

afterEach(() => __resetRegistry());

describe("resolveTarget", () => {
  it("uses the English lesson when the target has been translated", () => {
    __setContentRoot(makeTree({
      es: [{ slug: "uno", title: "Uno", order: 1 }],
      en: [{ slug: "uno", title: "One", order: 1 }],
    }));

    expect(resolveTarget("dl-nlp", "uno", "en")).toMatchObject({
      locale: "en",
      lesson: { title: "One" },
    });
  });

  it("falls back to the Spanish lesson for an untranslated target", () => {
    // The bug this function exists for: before it, this returned null and the reference
    // rendered as plain text — no link, no card, no error anywhere.
    __setContentRoot(makeTree({
      es: [{ slug: "uno", title: "Uno", order: 1 }, { slug: "dos", title: "Dos", order: 2 }],
      en: [{ slug: "uno", title: "One", order: 1 }],
    }));

    expect(resolveTarget("dl-nlp", "dos", "en")).toMatchObject({
      locale: "es",
      lesson: { title: "Dos" },
    });
  });

  it("returns null for a slug that exists in neither tree", () => {
    __setContentRoot(makeTree({ es: [{ slug: "uno", title: "Uno", order: 1 }] }));

    expect(resolveTarget("dl-nlp", "tres", "en")).toBeNull();
  });

  it("does not look into the English tree from a Spanish lesson", () => {
    // The fallback runs one way. Spanish is the spine; a slug that is only English is a
    // typo, and the lint says so.
    __setContentRoot(makeTree({
      es: [{ slug: "uno", title: "Uno", order: 1 }],
      en: [{ slug: "uno", title: "One", order: 1 }, { slug: "dos", title: "Two", order: 2 }],
    }));

    expect(resolveTarget("dl-nlp", "dos", "es")).toBeNull();
  });

  it("prefers the published Spanish lesson over a draft English one", () => {
    __setContentRoot(makeTree({
      es: [{ slug: "uno", title: "Uno", order: 1 }, { slug: "dos", title: "Dos", order: 2 }],
      en: [{ slug: "dos", title: "Two", order: 2, draft: true }],
    }));

    expect(resolveTarget("dl-nlp", "dos", "en")).toMatchObject({
      locale: "es",
      lesson: { title: "Dos", draft: false },
    });
  });

  it("keeps a draft target findable so the component can downgrade it", () => {
    // `getLesson` is deliberately not draft-filtered: a draft in both trees has to come
    // back as a DRAFT, not as null, or it looks like a typo to the lint.
    __setContentRoot(makeTree({
      es: [{ slug: "uno", title: "Uno", order: 1 }, { slug: "dos", title: "Dos", order: 2, draft: true }],
      en: [{ slug: "dos", title: "Two", order: 2, draft: true }],
    }));

    expect(resolveTarget("dl-nlp", "dos", "en")).toMatchObject({
      locale: "en",
      lesson: { draft: true },
    });
  });

  it("leaves the position rule untouched, whichever tree answered", () => {
    // `block`/`order` are identical across locales by locked decision, so a fallback
    // target classifies exactly as its translated twin would.
    __setContentRoot(makeTree({
      es: [
        { slug: "uno",  title: "Uno",  block: 1, order: 1 },
        { slug: "dos",  title: "Dos",  block: 1, order: 2 },
        { slug: "tres", title: "Tres", block: 2, order: 1 },
      ],
      en: [{ slug: "dos", title: "Two", block: 1, order: 2 }],
    }));

    const current = resolveTarget("dl-nlp", "dos", "en")!.lesson;
    const behind  = resolveTarget("dl-nlp", "uno", "en")!;
    const ahead   = resolveTarget("dl-nlp", "tres", "en")!;

    expect(behind.locale).toBe("es");
    expect(ahead.locale).toBe("es");
    expect(isAhead(current, behind.lesson)).toBe(false);
    expect(isAhead(current, ahead.lesson)).toBe(true);
  });
});
