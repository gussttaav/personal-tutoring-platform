/*
 * COURSE-P7-01 — Tests for the `<Leccion slug>` ⇄ registry content lint.
 *
 * The point of the component is that a cross-reference stops being prose the build
 * cannot read. That only holds if the build actually refuses a slug that resolves to
 * nothing and an anchor that resolves to no heading — otherwise the phase has replaced
 * 403 lies the reader can spot with 403 links that go nowhere.
 *
 * A draft target is deliberately NOT a failure: the component renders it as plain text
 * on purpose, so it is an advisory warning instead.
 *
 * COURSE-P11-01 — and it has to hold on a PARTIALLY translated tree, which is the state
 * `en/` lives in for the whole of Phase 11. The last two describes are that state: a slug
 * resolves in its own locale tree or in the canonical one, and the anchor is checked
 * against whichever of the two the target actually came from.
 *
 * COURSE-C2-P0-02 — and across COURSES. `<Leccion curso="dl-nlp" slug="…">` in an
 * `llm-agents` lesson resolves in `dl-nlp`'s trees with the same two-step; an unknown
 * course or a slug that is not there is fatal, naming the referring file, and a `curso`
 * naming the course the reference is written in is advisory. The final describe builds
 * two fake courses in one temp root, which is the only way to exercise it: `content/`
 * has one course with lessons, so the pipeline fixture can only name itself.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  crosslinkProblems,
  crosslinkWarnings,
  findLecciones,
  resolveCrosslinkTarget,
  validateCrosslinks,
  collectCrosslinkWarnings,
  type CrosslinkIndex,
  type CrosslinkScope,
} from "../validate-crosslinks";

/** An index of two lessons: one published with a heading, one draft. */
function index(): CrosslinkIndex {
  return new Map([
    ["la-neurona", { draft: false, headingIds: new Set(["qué-calcula-una-neurona"]) }],
    ["pipeline-fixture", { draft: true, headingIds: new Set<string>() }],
  ]);
}

function lesson({ slug = "demo", draft = false, body = "" } = {}): string {
  return `---\nslug: ${slug}\ntitle: "Demo"\ndraft: ${draft}\n---\n\n${body}\n`;
}

describe("findLecciones", () => {
  it("captures the slug and the anchor of every reference, in source order", () => {
    const refs = findLecciones(
      'Uno <Leccion slug="a" ancla="una-sección">texto</Leccion> y dos <Leccion slug="b" />.',
    );

    expect(refs).toEqual([
      { curso: null, slug: "a", ancla: "una-sección" },
      { curso: null, slug: "b", ancla: null },
    ]);
  });

  it("reports a missing slug as null rather than skipping the tag", () => {
    expect(findLecciones("<Leccion>texto</Leccion>")).toEqual([
      { curso: null, slug: null, ancla: null },
    ]);
  });

  it("captures `curso` — the cross-course form (COURSE-C2-P0-02)", () => {
    const refs = findLecciones(
      'Ver <Leccion curso="dl-nlp" slug="a" ancla="una-sección">A</Leccion> y <Leccion slug="b" curso="dl-nlp" />.',
    );

    expect(refs).toEqual([
      { curso: "dl-nlp", slug: "a", ancla: "una-sección" },
      { curso: "dl-nlp", slug: "b", ancla: null },
    ]);
  });

  it("reads references out of frontmatter — quiz copy is where 72 of them live", () => {
    const source = [
      "---",
      "slug: demo",
      "quiz:",
      "  - id: q-uno",
      "    explanation: 'lo desarrolla <Leccion slug=\"a\">A</Leccion>'",
      "---",
      "",
      "Cuerpo.",
    ].join("\n");

    expect(findLecciones(source)).toEqual([{ curso: null, slug: "a", ancla: null }]);
  });

  it("ignores a `<Leccion>` inside a fenced block — that is documentation", () => {
    const source = ["```mdx", '<Leccion slug="inventado" />', "```"].join("\n");

    expect(findLecciones(source)).toEqual([]);
  });

  it("does not mistake the closing tag for another reference", () => {
    expect(findLecciones('<Leccion slug="a">t</Leccion>')).toHaveLength(1);
  });
});

describe("crosslinkProblems", () => {
  it("says nothing when the slug and the anchor both resolve", () => {
    const refs = findLecciones('<Leccion slug="la-neurona" ancla="qué-calcula-una-neurona">t</Leccion>');

    expect(crosslinkProblems(refs, index())).toEqual([]);
  });

  it("rejects a slug that resolves to no lesson", () => {
    const problems = crosslinkProblems(findLecciones('<Leccion slug="la-neurna" />'), index());

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/unknown lesson slug "la-neurna"/);
  });

  it("rejects an anchor whose heading was retitled, naming slug and anchor", () => {
    const refs = findLecciones('<Leccion slug="la-neurona" ancla="que-calcula" />');
    const problems = crosslinkProblems(refs, index());

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/no heading "#que-calcula"/);
    expect(problems[0]).toMatch(/la-neurona/);
  });

  it("rejects a `<Leccion>` with no slug at all", () => {
    const problems = crosslinkProblems(findLecciones("<Leccion>texto</Leccion>"), index());

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/missing a slug attribute/);
  });

  it("accepts a self-reference — an anchor to one's own section is a valid link", () => {
    const self: CrosslinkIndex = new Map([
      ["demo", { draft: false, headingIds: new Set(["una-sección"]) }],
    ]);
    const refs = findLecciones('<Leccion slug="demo" ancla="una-sección">aquí mismo</Leccion>');

    expect(crosslinkProblems(refs, self)).toEqual([]);
  });

  it("accepts a draft target — plain text is the designed answer, not an error", () => {
    expect(crosslinkProblems(findLecciones('<Leccion slug="pipeline-fixture" />'), index())).toEqual(
      [],
    );
  });
});

describe("crosslinkWarnings", () => {
  it("warns about a draft target", () => {
    const warnings = crosslinkWarnings(findLecciones('<Leccion slug="pipeline-fixture" />'), index());

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/pipeline-fixture/);
    expect(warnings[0]).toMatch(/plain text/);
  });

  it("says nothing about a published target", () => {
    expect(crosslinkWarnings(findLecciones('<Leccion slug="la-neurona" />'), index())).toEqual([]);
  });
});

describe("validateCrosslinks", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "crosslink-lint-"));
    fs.mkdirSync(path.join(root, "demo", "es"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function write(name: string, source: string) {
    fs.writeFileSync(path.join(root, "demo", "es", name), source, "utf8");
  }

  it("passes when every reference resolves", () => {
    write("01-a.mdx", lesson({ slug: "a", body: "## Una sección\n\nTexto." }));
    write("02-b.mdx", lesson({ slug: "b", body: '<Leccion slug="a" ancla="una-sección">A</Leccion>' }));

    expect(() => validateCrosslinks(root)).not.toThrow();
  });

  it("throws naming the offending file and the slug", () => {
    write("01-a.mdx", lesson({ slug: "a" }));
    write("02-b.mdx", lesson({ slug: "b", body: '<Leccion slug="nope" />' }));

    expect(() => validateCrosslinks(root)).toThrow(/02-b\.mdx: .*nope/);
  });

  it("throws on a stale anchor", () => {
    write("01-a.mdx", lesson({ slug: "a", body: "## Otra sección\n\nTexto." }));
    write("02-b.mdx", lesson({ slug: "b", body: '<Leccion slug="a" ancla="una-sección" />' }));

    expect(() => validateCrosslinks(root)).toThrow(/02-b\.mdx: no heading "#una-sección"/);
  });

  it("does not let the canonical tree fall back to a translation", () => {
    // The fallback runs one way only. A Spanish lesson citing a slug that exists solely
    // in `en/` is a typo, not a partial translation — the Spanish tree IS the spine.
    fs.mkdirSync(path.join(root, "demo", "en"), { recursive: true });
    fs.writeFileSync(path.join(root, "demo", "en", "01-a.mdx"), lesson({ slug: "a" }), "utf8");
    write("02-b.mdx", lesson({ slug: "b", body: '<Leccion slug="a" />' }));

    expect(() => validateCrosslinks(root)).toThrow(/es.*02-b\.mdx: .*"a"/);
  });

  it("is a no-op when the content root does not exist", () => {
    expect(() => validateCrosslinks(path.join(root, "nope"))).not.toThrow();
  });
});

describe("collectCrosslinkWarnings", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "crosslink-warn-"));
    fs.mkdirSync(path.join(root, "demo", "es"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function write(name: string, source: string) {
    fs.writeFileSync(path.join(root, "demo", "es", name), source, "utf8");
  }

  it("keys a draft-target warning by the referring file", () => {
    write("01-a.mdx", lesson({ slug: "a", draft: true }));
    write("02-b.mdx", lesson({ slug: "b", body: '<Leccion slug="a" />' }));

    const notes = collectCrosslinkWarnings(root);

    expect([...notes.keys()]).toEqual([path.join(root, "demo", "es", "02-b.mdx")]);
    expect(notes.get(path.join(root, "demo", "es", "02-b.mdx"))?.[0]).toMatch(/draft/);
  });

  it("stays silent when the referring lesson is itself a draft — it has no readers", () => {
    write("01-a.mdx", lesson({ slug: "a", draft: true }));
    write("02-b.mdx", lesson({ slug: "b", draft: true, body: '<Leccion slug="a" />' }));

    expect(collectCrosslinkWarnings(root).size).toBe(0);
  });
});

/*
 * COURSE-P11-01 — the pure half of the canonical fallback.
 */
describe("resolveCrosslinkTarget", () => {
  const enOnly: CrosslinkIndex = new Map([
    ["a", { draft: false, headingIds: new Set(["a-section"]) }],
  ]);
  const esOnly: CrosslinkIndex = new Map([
    ["a", { draft: false, headingIds: new Set(["una-sección"]) }],
    ["b", { draft: false, headingIds: new Set<string>() }],
  ]);

  it("prefers the lesson's own locale when the target is translated", () => {
    expect(resolveCrosslinkTarget("a", enOnly, esOnly)?.headingIds).toEqual(
      new Set(["a-section"]),
    );
  });

  it("falls back to the canonical tree for an untranslated target", () => {
    expect(resolveCrosslinkTarget("b", enOnly, esOnly)?.headingIds).toEqual(new Set());
  });

  it("returns null for a slug that is in neither tree", () => {
    expect(resolveCrosslinkTarget("nope", enOnly, esOnly)).toBeNull();
  });

  it("is a single lookup when the tree IS the canonical one", () => {
    expect(resolveCrosslinkTarget("a", esOnly, esOnly)?.headingIds).toEqual(
      new Set(["una-sección"]),
    );
    expect(resolveCrosslinkTarget("a", esOnly)?.headingIds).toEqual(new Set(["una-sección"]));
  });

  it("resolves a target drafted here but published canonically to the published one", () => {
    const draftedEn: CrosslinkIndex = new Map([
      ["a", { draft: true, headingIds: new Set(["a-section"]) }],
    ]);

    const target = resolveCrosslinkTarget("a", draftedEn, esOnly);

    expect(target?.draft).toBe(false);
    expect(target?.headingIds).toEqual(new Set(["una-sección"]));
  });

  it("keeps the draft when it is a draft in both trees", () => {
    const draftedEn: CrosslinkIndex = new Map([
      ["a", { draft: true, headingIds: new Set(["a-section"]) }],
    ]);
    const draftedEs: CrosslinkIndex = new Map([
      ["a", { draft: true, headingIds: new Set(["una-sección"]) }],
    ]);

    expect(resolveCrosslinkTarget("a", draftedEn, draftedEs)?.draft).toBe(true);
  });
});

/*
 * COURSE-P11-01 — the state Phase 11 lives in: `en/` holds one lesson and everything it
 * cites is still Spanish-only. Before this task the first English file failed the lint.
 */
describe("validateCrosslinks — a partially translated tree", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "crosslink-partial-"));
    fs.mkdirSync(path.join(root, "demo", "es"), { recursive: true });
    fs.mkdirSync(path.join(root, "demo", "en"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function writeEs(name: string, source: string) {
    fs.writeFileSync(path.join(root, "demo", "es", name), source, "utf8");
  }

  function writeEn(name: string, source: string) {
    fs.writeFileSync(path.join(root, "demo", "en", name), source, "utf8");
  }

  it("passes when one English lesson cites targets that exist only in Spanish", () => {
    writeEs("01-a.mdx", lesson({ slug: "a" }));
    writeEs("02-b.mdx", lesson({ slug: "b" }));
    writeEs("03-c.mdx", lesson({ slug: "c" }));
    writeEs("04-d.mdx", lesson({ slug: "d" }));
    writeEn(
      "01-a.mdx",
      lesson({
        slug: "a",
        body: '<Leccion slug="b" /> <Leccion slug="c" /> <Leccion slug="d" />',
      }),
    );

    expect(() => validateCrosslinks(root)).not.toThrow();
  });

  it("still fails on a slug that is in neither tree, naming the file", () => {
    writeEs("01-a.mdx", lesson({ slug: "a" }));
    writeEn("01-a.mdx", lesson({ slug: "a", body: '<Leccion slug="nope" />' }));

    expect(() => validateCrosslinks(root)).toThrow(/en.*01-a\.mdx: .*"nope"/);
  });

  it("checks an untranslated target's anchor against the SPANISH headings", () => {
    writeEs("01-a.mdx", lesson({ slug: "a" }));
    writeEs("02-b.mdx", lesson({ slug: "b", body: "## Una sección\n\nTexto." }));
    writeEn("01-a.mdx", lesson({ slug: "a", body: '<Leccion slug="b" ancla="una-sección" />' }));

    expect(() => validateCrosslinks(root)).not.toThrow();
  });

  it("rejects an English anchor on a target that has not been translated yet", () => {
    writeEs("01-a.mdx", lesson({ slug: "a" }));
    writeEs("02-b.mdx", lesson({ slug: "b", body: "## Una sección\n\nTexto." }));
    writeEn("01-a.mdx", lesson({ slug: "a", body: '<Leccion slug="b" ancla="a-section" />' }));

    expect(() => validateCrosslinks(root)).toThrow(/en.*01-a\.mdx: no heading "#a-section"/);
  });

  it("flips an inbound anchor to the English ids the moment the target is translated", () => {
    // The maintenance hazard this rule creates, stated as a test: `01-a.mdx` is untouched
    // by the PR that adds `en/02-b.mdx`, and the lint fails it — correctly, because the
    // page it points at now renders `#a-section`, not `#una-sección`.
    writeEs("01-a.mdx", lesson({ slug: "a" }));
    writeEs("02-b.mdx", lesson({ slug: "b", body: "## Una sección\n\nTexto." }));
    writeEn("01-a.mdx", lesson({ slug: "a", body: '<Leccion slug="b" ancla="una-sección" />' }));
    writeEn("02-b.mdx", lesson({ slug: "b", body: "## A section\n\nText." }));

    expect(() => validateCrosslinks(root)).toThrow(/en.*01-a\.mdx: no heading "#una-sección"/);

    writeEn("01-a.mdx", lesson({ slug: "a", body: '<Leccion slug="b" ancla="a-section" />' }));
    expect(() => validateCrosslinks(root)).not.toThrow();
  });

  it("keeps the Spanish tree on Spanish anchors when both versions exist", () => {
    writeEs("01-a.mdx", lesson({ slug: "a", body: '<Leccion slug="b" ancla="a-section" />' }));
    writeEs("02-b.mdx", lesson({ slug: "b", body: "## Una sección\n\nTexto." }));
    writeEn("02-b.mdx", lesson({ slug: "b", body: "## A section\n\nText." }));

    expect(() => validateCrosslinks(root)).toThrow(/es.*01-a\.mdx: no heading "#a-section"/);
  });

  it("takes the published Spanish lesson over a draft English one", () => {
    writeEs("01-a.mdx", lesson({ slug: "a" }));
    writeEs("02-b.mdx", lesson({ slug: "b", body: "## Una sección\n\nTexto." }));
    writeEn("01-a.mdx", lesson({ slug: "a", body: '<Leccion slug="b" ancla="una-sección" />' }));
    writeEn("02-b.mdx", lesson({ slug: "b", draft: true, body: "## A section\n\nText." }));

    expect(() => validateCrosslinks(root)).not.toThrow();

    // …and it links, so there is nothing to advise about.
    const notes = collectCrosslinkWarnings(root);
    expect(notes.get(path.join(root, "demo", "en", "01-a.mdx"))).toBeUndefined();
  });

  it("warns when the target is a draft in both trees", () => {
    writeEs("01-a.mdx", lesson({ slug: "a" }));
    writeEs("02-b.mdx", lesson({ slug: "b", draft: true }));
    writeEn("01-a.mdx", lesson({ slug: "a", body: '<Leccion slug="b" />' }));
    writeEn("02-b.mdx", lesson({ slug: "b", draft: true }));

    const notes = collectCrosslinkWarnings(root);

    expect(notes.get(path.join(root, "demo", "en", "01-a.mdx"))?.[0]).toMatch(/draft/);
  });

  it("takes the canonical locale as a parameter rather than importing routing", () => {
    // `validate-crosslinks.ts` must stay Node-clean; the canonical directory name is an
    // argument, so a caller with a different default can say so.
    writeEs("01-a.mdx", lesson({ slug: "a", body: '<Leccion slug="b" />' }));
    writeEn("01-b.mdx", lesson({ slug: "b" }));

    expect(() => validateCrosslinks(root)).toThrow(/es.*01-a\.mdx: .*"b"/);
    expect(() => validateCrosslinks(root, "en")).not.toThrow();
  });
});

/*
 * COURSE-C2-P0-02 — the pure half of a `curso=` reference: which trees it resolves in.
 */
describe("crosslinkProblems / crosslinkWarnings — `curso=` (COURSE-C2-P0-02)", () => {
  const agentsEs: CrosslinkIndex = new Map([
    ["agente", { draft: false, headingIds: new Set(["el-bucle"]) }],
  ]);
  const nlpEs: CrosslinkIndex = new Map([
    ["proyecto-transformer", { draft: false, headingIds: new Set(["la-función"]) }],
    ["borrador", { draft: true, headingIds: new Set<string>() }],
  ]);
  const nlpEn: CrosslinkIndex = new Map([
    ["proyecto-transformer", { draft: false, headingIds: new Set(["the-function"]) }],
  ]);
  const courses = new Map([
    ["llm-agents", new Map([["es", agentsEs]])],
    ["dl-nlp", new Map([["es", nlpEs], ["en", nlpEn]])],
  ]);
  const inAgentsEs: CrosslinkScope = {
    course: "llm-agents", locale: "es", canonicalLocale: "es", courses,
  };

  it("resolves a slug in the named course, not in the referring one", () => {
    const refs = findLecciones('<Leccion curso="dl-nlp" slug="proyecto-transformer">…</Leccion>');

    expect(crosslinkProblems(refs, agentsEs, undefined, inAgentsEs)).toEqual([]);
    // …and the same slug without `curso` is unknown here: the lookup did not leak.
    expect(crosslinkProblems(findLecciones('<Leccion slug="proyecto-transformer" />'), agentsEs, undefined, inAgentsEs))
      .toEqual([expect.stringMatching(/unknown lesson slug "proyecto-transformer"/)]);
  });

  it("rejects a slug that is not in the named course, naming both", () => {
    const refs = findLecciones('<Leccion curso="dl-nlp" slug="no-existe" />');
    const problems = crosslinkProblems(refs, agentsEs, undefined, inAgentsEs);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/unknown lesson slug "no-existe" in course "dl-nlp"/);
  });

  it("rejects a `curso` that names no course", () => {
    const refs = findLecciones('<Leccion curso="no-course" slug="agente" />');
    const problems = crosslinkProblems(refs, agentsEs, undefined, inAgentsEs);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/unknown course "no-course"/);
  });

  it("treats every `curso` as an unknown course when there is no scope to resolve it in", () => {
    const refs = findLecciones('<Leccion curso="dl-nlp" slug="proyecto-transformer" />');

    expect(crosslinkProblems(refs, agentsEs)).toEqual([expect.stringMatching(/unknown course "dl-nlp"/)]);
  });

  it("checks `ancla` against the TARGET course's headings", () => {
    const ok = findLecciones('<Leccion curso="dl-nlp" slug="proyecto-transformer" ancla="la-función" />');
    const stale = findLecciones('<Leccion curso="dl-nlp" slug="proyecto-transformer" ancla="el-bucle" />');

    expect(crosslinkProblems(ok, agentsEs, undefined, inAgentsEs)).toEqual([]);
    // `el-bucle` is a heading in the REFERRING course; the anchor followed the target.
    expect(crosslinkProblems(stale, agentsEs, undefined, inAgentsEs)).toEqual([
      expect.stringMatching(/no heading "#el-bucle" in lesson "proyecto-transformer" in course "dl-nlp"/),
    ]);
  });

  it("runs the two-step in the named course from a translated lesson", () => {
    // From `llm-agents/en/`: `dl-nlp/en/` first (English heading ids), `dl-nlp/es/` for what
    // is not translated there — the P11-01 rule, one course over.
    const inAgentsEn: CrosslinkScope = { ...inAgentsEs, locale: "en" };
    const enAnchor = findLecciones('<Leccion curso="dl-nlp" slug="proyecto-transformer" ancla="the-function" />');
    const esAnchor = findLecciones('<Leccion curso="dl-nlp" slug="proyecto-transformer" ancla="la-función" />');
    const untranslated = findLecciones('<Leccion curso="dl-nlp" slug="borrador" />');

    expect(crosslinkProblems(enAnchor, new Map(), agentsEs, inAgentsEn)).toEqual([]);
    expect(crosslinkProblems(esAnchor, new Map(), agentsEs, inAgentsEn)).toEqual([
      expect.stringMatching(/no heading "#la-función"/),
    ]);
    expect(crosslinkProblems(untranslated, new Map(), agentsEs, inAgentsEn)).toEqual([]);
  });

  it("resolves through the canonical tree alone when the named course has no such locale", () => {
    // `llm-agents` exists in `es/` only; from an `en/` lesson elsewhere its own tree is
    // empty and the canonical one answers — the untranslated-target rule, across courses.
    const inNlpEn: CrosslinkScope = { course: "dl-nlp", locale: "en", canonicalLocale: "es", courses };
    const refs = findLecciones('<Leccion curso="llm-agents" slug="agente" ancla="el-bucle" />');

    expect(crosslinkProblems(refs, nlpEn, nlpEs, inNlpEn)).toEqual([]);
  });

  it("warns — does not fail — on a `curso` naming the referring course, and still resolves it", () => {
    const refs = findLecciones('<Leccion curso="llm-agents" slug="agente" ancla="el-bucle" />');

    expect(crosslinkProblems(refs, agentsEs, undefined, inAgentsEs)).toEqual([]);
    expect(crosslinkWarnings(refs, agentsEs, undefined, inAgentsEs)).toEqual([
      expect.stringMatching(/curso="llm-agents" names this very course; drop the attribute/),
    ]);
    // The redundant attribute changes nothing about the slug check.
    expect(crosslinkProblems(findLecciones('<Leccion curso="llm-agents" slug="nope" />'), agentsEs, undefined, inAgentsEs))
      .toEqual([expect.stringMatching(/unknown lesson slug "nope"/)]);
  });

  it("warns about a draft target in the named course, naming the course", () => {
    const warnings = crosslinkWarnings(
      findLecciones('<Leccion curso="dl-nlp" slug="borrador" />'), agentsEs, undefined, inAgentsEs,
    );

    expect(warnings).toEqual([expect.stringMatching(/"borrador" in course "dl-nlp" is a draft lesson/)]);
  });

  it("stays quiet about an unknown course — that is the fatal pass's finding", () => {
    const refs = findLecciones('<Leccion curso="no-course" slug="x" />');

    expect(crosslinkWarnings(refs, agentsEs, undefined, inAgentsEs)).toEqual([]);
  });
});

/*
 * COURSE-C2-P0-02 — two courses in one content root, which `content/` will not have with
 * lessons in both until Phase 1: `llm-agents` referring back to `dl-nlp`.
 */
describe("validateCrosslinks — across courses", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "crosslink-courses-"));
    for (const dir of [["dl-nlp", "es"], ["dl-nlp", "en"], ["llm-agents", "es"], ["llm-agents", "en"]]) {
      fs.mkdirSync(path.join(root, ...dir), { recursive: true });
    }
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function write(course: string, locale: string, name: string, source: string) {
    fs.writeFileSync(path.join(root, course, locale, name), source, "utf8");
  }

  it("passes when an llm-agents lesson cites a dl-nlp lesson that exists there", () => {
    write("dl-nlp", "es", "09-proyecto.mdx", lesson({ slug: "proyecto-transformer", body: "## La función\n\nTexto." }));
    write("llm-agents", "es", "01-a.mdx", lesson({
      slug: "a",
      body: '<Leccion curso="dl-nlp" slug="proyecto-transformer" ancla="la-función">la función</Leccion>',
    }));

    expect(() => validateCrosslinks(root)).not.toThrow();
  });

  it("fails on a slug that is not in the named course, naming the referring file", () => {
    write("dl-nlp", "es", "09-proyecto.mdx", lesson({ slug: "proyecto-transformer" }));
    write("llm-agents", "es", "01-a.mdx", lesson({ slug: "a", body: '<Leccion curso="dl-nlp" slug="no-existe" />' }));

    expect(() => validateCrosslinks(root)).toThrow(/llm-agents.*01-a\.mdx: unknown lesson slug "no-existe" in course "dl-nlp"/);
  });

  it("fails on a `curso` that names no course, the same way", () => {
    write("dl-nlp", "es", "09-proyecto.mdx", lesson({ slug: "proyecto-transformer" }));
    write("llm-agents", "es", "01-a.mdx", lesson({ slug: "a", body: '<Leccion curso="no-course" slug="proyecto-transformer" />' }));

    expect(() => validateCrosslinks(root)).toThrow(/llm-agents.*01-a\.mdx: unknown course "no-course"/);
  });

  it("does not let a bare slug resolve in another course", () => {
    // The widening is the LOOKUP for `curso=`, not the scope: without the attribute a
    // dl-nlp slug is still unknown in llm-agents.
    write("dl-nlp", "es", "09-proyecto.mdx", lesson({ slug: "proyecto-transformer" }));
    write("llm-agents", "es", "01-a.mdx", lesson({ slug: "a", body: '<Leccion slug="proyecto-transformer" />' }));

    expect(() => validateCrosslinks(root)).toThrow(/llm-agents.*01-a\.mdx: unknown lesson slug "proyecto-transformer"/);
  });

  it("checks an anchor against the target's tree, English first from an English lesson", () => {
    write("dl-nlp", "es", "09-proyecto.mdx", lesson({ slug: "proyecto-transformer", body: "## La función\n\nTexto." }));
    write("dl-nlp", "en", "09-proyecto.mdx", lesson({ slug: "proyecto-transformer", body: "## The function\n\nText." }));
    write("llm-agents", "es", "01-a.mdx", lesson({ slug: "a", body: '<Leccion curso="dl-nlp" slug="proyecto-transformer" ancla="la-función" />' }));
    write("llm-agents", "en", "01-a.mdx", lesson({ slug: "a", body: '<Leccion curso="dl-nlp" slug="proyecto-transformer" ancla="the-function" />' }));

    expect(() => validateCrosslinks(root)).not.toThrow();

    write("llm-agents", "en", "01-a.mdx", lesson({ slug: "a", body: '<Leccion curso="dl-nlp" slug="proyecto-transformer" ancla="la-función" />' }));
    expect(() => validateCrosslinks(root)).toThrow(/llm-agents.*en.*01-a\.mdx: no heading "#la-función"/);
  });

  it("falls back to the target course's Spanish tree from an English lesson", () => {
    write("dl-nlp", "es", "09-proyecto.mdx", lesson({ slug: "proyecto-transformer", body: "## La función\n\nTexto." }));
    write("llm-agents", "es", "01-a.mdx", lesson({ slug: "a" }));
    write("llm-agents", "en", "01-a.mdx", lesson({ slug: "a", body: '<Leccion curso="dl-nlp" slug="proyecto-transformer" ancla="la-función" />' }));

    expect(() => validateCrosslinks(root)).not.toThrow();
  });

  it("warns, keyed by the referring file, on a `curso` naming its own course", () => {
    write("dl-nlp", "es", "09-proyecto.mdx", lesson({ slug: "proyecto-transformer" }));
    write("llm-agents", "es", "01-a.mdx", lesson({ slug: "a" }));
    write("llm-agents", "es", "02-b.mdx", lesson({ slug: "b", body: '<Leccion curso="llm-agents" slug="a" />' }));

    expect(() => validateCrosslinks(root)).not.toThrow();

    const notes = collectCrosslinkWarnings(root);
    expect([...notes.keys()]).toEqual([path.join(root, "llm-agents", "es", "02-b.mdx")]);
    expect(notes.get(path.join(root, "llm-agents", "es", "02-b.mdx"))?.[0]).toMatch(/drop the attribute/);
  });

  it("warns on a draft target in the other course, and does not fail", () => {
    write("dl-nlp", "es", "09-proyecto.mdx", lesson({ slug: "proyecto-transformer", draft: true }));
    write("llm-agents", "es", "01-a.mdx", lesson({ slug: "a", body: '<Leccion curso="dl-nlp" slug="proyecto-transformer" />' }));

    expect(() => validateCrosslinks(root)).not.toThrow();
    expect(collectCrosslinkWarnings(root).get(path.join(root, "llm-agents", "es", "01-a.mdx"))?.[0])
      .toMatch(/"proyecto-transformer" in course "dl-nlp" is a draft/);
  });
});
