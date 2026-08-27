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
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  crosslinkProblems,
  crosslinkWarnings,
  findLecciones,
  validateCrosslinks,
  collectCrosslinkWarnings,
  type CrosslinkIndex,
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
      { slug: "a", ancla: "una-sección" },
      { slug: "b", ancla: null },
    ]);
  });

  it("reports a missing slug as null rather than skipping the tag", () => {
    expect(findLecciones("<Leccion>texto</Leccion>")).toEqual([{ slug: null, ancla: null }]);
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

    expect(findLecciones(source)).toEqual([{ slug: "a", ancla: null }]);
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

  it("resolves against the lesson's OWN locale tree", () => {
    // `es/` has the lesson, `en/` does not: the same reference is valid in one and a
    // broken slug in the other. Anchors never have to cross languages.
    fs.mkdirSync(path.join(root, "demo", "en"), { recursive: true });
    write("01-a.mdx", lesson({ slug: "a" }));
    fs.writeFileSync(
      path.join(root, "demo", "en", "02-b.mdx"),
      lesson({ slug: "b", body: '<Leccion slug="a" />' }),
      "utf8",
    );

    expect(() => validateCrosslinks(root)).toThrow(/en.*02-b\.mdx: .*"a"/);
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
