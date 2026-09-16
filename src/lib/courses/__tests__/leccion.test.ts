/*
 * COURSE-P7-01 — Tests for the rule that decides whether a reference links.
 *
 * `isAhead` is the whole of "nothing here is authored": the author writes a slug, and
 * where the target sits in the (block, order) spine decides how it renders. Get the
 * comparison wrong and forward references start linking from inside the bridge — the one
 * place the phase deliberately keeps quiet, because `LessonNav` is already there.
 *
 * Only the pure helpers are exercised for the within-course rules. The component around
 * them is an async Server Component that reads next-intl's request context; those rules
 * are verified in the browser and by the pipeline fixture, not here (the cross-course
 * describe at the end is the one exception, and says why).
 *
 * COURSE-P11-01 — `resolveTarget` is the second helper, and it carries the other half of
 * "nothing here is authored": WHICH tree a slug resolves in. On a translated lesson under
 * `/en` most targets are still Spanish-only, and resolving them in the English tree alone
 * returns null — no link, no card, no error. Its cases run against a temp fixture tree,
 * the same `__setContentRoot` arrangement `catalog-view.test.ts` uses.
 *
 * COURSE-C2-P0-02 — `curso="…"` is the first rule that is not a pure helper: it changes
 * WHICH card renders, and the card is the deliverable. The last describe renders the
 * component itself, with the two request-bound imports replaced — `getTranslations`
 * reads the real message files, `Link` is a bare `<a>` — so the markup can be asserted
 * without a Next request. Only the cross-course cases go through it; the within-course
 * rules stay with the fixture and the browser, as before.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";

import { __resetRegistry, __setContentRoot } from "@/lib/courses/registry";

import { isAhead, makeLeccion, resolveTarget, type LeccionCtx, type LeccionProps } from "../Leccion";

jest.mock("next-intl/server", () => {
  // The real copy, so the assertions below read what the reader reads. `{name}` is the
  // only ICU feature the `courses.reader` keys use.
  const messages: Record<string, Record<string, Record<string, Record<string, string>>>> = {
    es: jest.requireActual("../../../../messages/es.json"),
    en: jest.requireActual("../../../../messages/en.json"),
  };
  return {
    getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
      const [a, b] = namespace.split(".");
      const ns = messages[locale][a][b];
      return (key: string, values: Record<string, unknown> = {}) =>
        ns[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
    },
  };
});

jest.mock("@/i18n/navigation", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  return {
    Link: ({ href, className, children }: { href: string; className?: string; children?: unknown }) =>
      createElement("a", { href, className }, children as never),
  };
});

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

function manifest(slug: string, title: string): string {
  return `
slug: ${slug}
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

/** Add one course to `root`: both manifests (`titles` per locale) and the lessons per locale. */
function addCourse(
  root: string,
  slug: string,
  titles: { es: string; en: string },
  lessons: Record<string, LessonSpec[]>,
): void {
  const courseDir = path.join(root, slug);
  fs.mkdirSync(courseDir, { recursive: true });
  fs.writeFileSync(path.join(courseDir, "course.es.yml"), manifest(slug, titles.es));
  fs.writeFileSync(path.join(courseDir, "course.en.yml"), manifest(slug, titles.en));

  for (const [locale, specs] of Object.entries(lessons)) {
    const dir = path.join(courseDir, locale);
    fs.mkdirSync(dir, { recursive: true });
    for (const spec of specs) {
      fs.writeFileSync(path.join(dir, `0${spec.order}-${spec.slug}.mdx`), lessonFile(spec));
    }
  }
}

/** A `dl-nlp` course with both manifests and the given lessons per locale. */
function makeTree(lessons: Record<string, LessonSpec[]>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "leccion-resolve-"));
  addCourse(root, "dl-nlp", { es: "Curso", en: "Course" }, lessons);
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

// ─── COURSE-C2-P0-02 — cross-course references, rendered ──────────────────────

/** `llm-agents` (the referring course) next to `dl-nlp` (the one it refers back to). */
function makeTwoCourses(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "leccion-curso-"));
  addCourse(root, "dl-nlp", { es: "Deep Learning para NLP", en: "Deep Learning for NLP" }, {
    es: [
      { slug: "proyecto-transformer", title: "Proyecto: el Transformer", block: 2, order: 9 },
      { slug: "solo-es", title: "Solo en español", block: 2, order: 8 },
      { slug: "borrador", title: "Borrador", block: 2, order: 7, draft: true },
    ],
    en: [{ slug: "proyecto-transformer", title: "Project: the Transformer", block: 2, order: 9 }],
  });
  addCourse(root, "llm-agents", { es: "Agentes LLM", en: "LLM Agents" }, {
    es: [
      { slug: "uno", title: "Uno", block: 1, order: 1 },
      { slug: "dos", title: "Dos", block: 1, order: 2 },
    ],
    en: [{ slug: "uno", title: "One", block: 1, order: 1 }],
  });
  return root;
}

/** The reader is on `llm-agents/uno`, in the given request + content locale. */
function readingUno(locale = "es", contentLocale = locale): LeccionCtx {
  return { courseSlug: "llm-agents", locale, contentLocale, current: { block: 1, order: 1 } };
}

async function render(ctx: LeccionCtx, props: LeccionProps): Promise<string> {
  const Leccion = makeLeccion(ctx);
  return renderToStaticMarkup(await Leccion(props));
}

const TO_TRANSFORMER = { curso: "dl-nlp", slug: "proyecto-transformer", children: "la función" };

describe("<Leccion curso=…> (COURSE-C2-P0-02)", () => {
  beforeEach(() => __setContentRoot(makeTwoCourses()));

  it("links to the other course, with the course title on its own line of the card", async () => {
    const html = await render(readingUno(), TO_TRANSFORMER);

    expect(html).toContain('<a href="/cursos/dl-nlp/proyecto-transformer" class="lesson-ref">la función</a>');
    expect(html).toContain('<span class="lesson-ref-course">Deep Learning para NLP</span>');
    expect(html).toContain('<span class="lesson-ref-kicker">Bloque 2 · Lección 9</span>');
    expect(html).toContain('<span class="lesson-ref-title">Proyecto: el Transformer</span>');
  });

  it("is never «ahead» — a later position in the other course is not a position at all", async () => {
    // Block 2, lesson 9 is "after" block 1, lesson 1 by the numbers; the numbers belong
    // to different spines. No «Más adelante», no `data-ahead`.
    const html = await render(readingUno(), TO_TRANSFORMER);

    expect(html).not.toContain("data-ahead");
    expect(html).not.toContain("Más adelante");
  });

  it("still links from inside the bridge, where a within-course forward reference goes plain", async () => {
    const cross = await render(readingUno(), { ...TO_TRANSFORMER, bridge: true });
    const within = await render(readingUno(), { slug: "dos", bridge: true, children: "la siguiente" });

    expect(cross).toContain('href="/cursos/dl-nlp/proyecto-transformer"');
    expect(within).toBe("la siguiente");
  });

  it("renders a draft target as plain text, exactly as within a course", async () => {
    const html = await render(readingUno(), { curso: "dl-nlp", slug: "borrador", children: "el borrador" });

    expect(html).toBe("el borrador");
  });

  it("appends `ancla` to the cross-course href", async () => {
    const html = await render(readingUno(), { ...TO_TRANSFORMER, ancla: "la-función" });

    expect(html).toContain('href="/cursos/dl-nlp/proyecto-transformer#la-función"');
  });

  it("under /en resolves the English target and names the course in English", async () => {
    const html = await render(readingUno("en"), TO_TRANSFORMER);

    expect(html).toContain('href="/cursos/dl-nlp/proyecto-transformer"');
    expect(html).toContain('<span class="lesson-ref-course">Deep Learning for NLP</span>');
    expect(html).toContain('<span class="lesson-ref-kicker">Block 2 · Lesson 9</span>');
    expect(html).toContain('<span class="lesson-ref-title">Project: the Transformer</span>');
    expect(html).not.toContain("In Spanish");
  });

  it("under /en falls back to the Spanish target, marked, with the course title still in English", async () => {
    // The P11-01 two-step, one course over: the lesson is Spanish-only, so its title and
    // summary are Spanish and the kicker says so — but the course title is chrome and
    // follows the request locale, like the kicker's own words.
    const html = await render(readingUno("en"), { curso: "dl-nlp", slug: "solo-es", children: "that one" });

    expect(html).toContain('<span class="lesson-ref-course">Deep Learning for NLP</span>');
    expect(html).toContain("Block 2 · Lesson 8 · In Spanish");
    expect(html).toContain('<span class="lesson-ref-title">Solo en español</span>');
  });

  it("under /en on an untranslated referring lesson marks a Spanish target too", async () => {
    // `contentLocale: "es"` — the reader is on `/en` but the prose fell back to Spanish.
    // The lookup starts (and ends) in `dl-nlp/es`; the card is still in the request locale.
    const html = await render(readingUno("en", "es"), TO_TRANSFORMER);

    expect(html).toContain('<span class="lesson-ref-title">Proyecto: el Transformer</span>');
    expect(html).toContain("Block 2 · Lesson 9 · In Spanish");
    expect(html).toContain('<span class="lesson-ref-course">Deep Learning for NLP</span>');
  });

  it("treats a `curso` naming the current course as no `curso` at all", async () => {
    // Same lesson, same reader, with and without the redundant attribute: identical markup —
    // the position rule applies (it is ahead), and no course line is added.
    const redundant = await render(readingUno(), { curso: "llm-agents", slug: "dos", children: "la siguiente" });
    const plain = await render(readingUno(), { slug: "dos", children: "la siguiente" });

    expect(redundant).toBe(plain);
    expect(redundant).toContain("data-ahead");
    expect(redundant).not.toContain("lesson-ref-course");
    // …including inside the bridge, where a within-course forward reference goes plain.
    expect(await render(readingUno(), { curso: "llm-agents", slug: "dos", bridge: true, children: "la siguiente" }))
      .toBe("la siguiente");
  });

  it("shows the dev marker, naming the course, for a slug that is not in it", async () => {
    const badSlug = await render(readingUno(), { curso: "dl-nlp", slug: "nope", children: "x" });
    const badCourse = await render(readingUno(), { curso: "no-course", slug: "proyecto-transformer", children: "x" });

    expect(badSlug).toContain("curso=&quot;dl-nlp&quot; slug=&quot;nope&quot;");
    expect(badSlug).toContain("no resuelve");
    expect(badCourse).toContain("curso=&quot;no-course&quot;");
    expect(badCourse).toContain("no resuelve");
  });

  it("does not resolve a bare slug in the other course", async () => {
    // The lookup widens only through `curso`; without it a dl-nlp slug is unknown here.
    const html = await render(readingUno(), { slug: "proyecto-transformer", children: "x" });

    expect(html).toContain("no resuelve");
  });
});
