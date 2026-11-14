/*
 * COURSE-C2-P3-01 — Tests for the `<RepoLink tag>` ⇄ lesson-locale content lint.
 *
 * D1 puts the English Block 5 code in the same repository under `en-b5-lN` tags, so the
 * only thing that keeps an English lesson from linking Spanish code is this check. Both
 * slips fail — a Spanish tag in `en/`, an English tag in `es/` — naming the file, and the
 * things that are not a tag (a `path=` attribute, a lesson with no link, a fenced sample)
 * stay quiet. The last describe runs the fs pass over a temp tree, and once over the real
 * content root, where the existing Spanish `<RepoLink>`s must pass unchanged.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  REPO_TAG_EN,
  REPO_TAG_ES,
  findRepoTags,
  repoLinkProblems,
  validateRepoLinks,
} from "../validate-repolinks";

function lesson(body: string): string {
  return `---\nslug: demo\ntitle: "Demo"\ndraft: false\n---\n\n${body}\n`;
}

describe("the tag patterns", () => {
  it("accept the nine lesson tags of each locale and nothing else", () => {
    for (let n = 1; n <= 9; n += 1) {
      expect(REPO_TAG_ES.test(`b5-l${n}`)).toBe(true);
      expect(REPO_TAG_EN.test(`en-b5-l${n}`)).toBe(true);
    }
    expect(REPO_TAG_ES.test("en-b5-l3")).toBe(false);
    expect(REPO_TAG_EN.test("b5-l3")).toBe(false);
    expect(REPO_TAG_ES.test("b5-l0")).toBe(false);
    expect(REPO_TAG_ES.test("b5-l10")).toBe(false);
    expect(REPO_TAG_EN.test("en-b5-lN")).toBe(false);
  });
});

describe("findRepoTags", () => {
  it("captures every tag in source order, both component forms", () => {
    const source = lesson(
      '<RepoLink tag="b5-l1">Al empezar</RepoLink>\n\ntexto\n\n<RepoLink tag="b5-l2" path="README.md" />',
    );
    expect(findRepoTags(source)).toEqual(["b5-l1", "b5-l2"]);
  });

  it("is not confused by a `path=` attribute, before or after the tag", () => {
    expect(findRepoTags('<RepoLink path="tag/b5-l1.py" tag="en-b5-l1" />')).toEqual(["en-b5-l1"]);
    expect(findRepoTags('<RepoLink tag="en-b5-l1" path="b5-l9/x.py">x</RepoLink>')).toEqual([
      "en-b5-l1",
    ]);
  });

  it("returns nothing for a lesson with no <RepoLink>", () => {
    expect(findRepoTags(lesson("Solo prosa y un <Leccion slug=\"a\">enlace</Leccion>."))).toEqual([]);
  });

  it("skips a mention with no tag attribute, a longer component name and a fenced sample", () => {
    const source = lesson(
      [
        "{/* `<RepoLink>` cubierto por el fixture */}",
        '<RepoLinkCard tag="b5-l1" />',
        "```mdx",
        '<RepoLink tag="b5-lN">Al empezar</RepoLink>',
        "```",
      ].join("\n"),
    );
    expect(findRepoTags(source)).toEqual([]);
  });
});

describe("repoLinkProblems", () => {
  it("passes a Spanish tag in es/ and an English tag in en/", () => {
    expect(repoLinkProblems(lesson('<RepoLink tag="b5-l3">x</RepoLink>'), "es")).toEqual([]);
    expect(repoLinkProblems(lesson('<RepoLink tag="en-b5-l3">x</RepoLink>'), "en")).toEqual([]);
  });

  it("fails a Spanish tag kept in an English lesson", () => {
    const problems = repoLinkProblems(lesson('<RepoLink tag="b5-l3">At the start</RepoLink>'), "en");
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('tag="b5-l3"');
    expect(problems[0]).toContain('"en"');
  });

  it("fails an English tag in a Spanish lesson", () => {
    const problems = repoLinkProblems(lesson('<RepoLink tag="en-b5-l3" path="bucle.py" />'), "es");
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('tag="en-b5-l3"');
  });

  it("reports only the bad tag when a lesson mixes good and bad", () => {
    const source = lesson('<RepoLink tag="en-b5-l2">a</RepoLink>\n\n<RepoLink tag="b5-l3">b</RepoLink>');
    expect(repoLinkProblems(source, "en")).toEqual([
      `<RepoLink tag="b5-l3"> in a "en" lesson must match ${REPO_TAG_EN.source}`,
    ]);
  });

  it("checks nothing in a locale it has no pattern for", () => {
    expect(repoLinkProblems(lesson('<RepoLink tag="anything" />'), "fr")).toEqual([]);
  });
});

describe("validateRepoLinks — the fs pass", () => {
  let root: string;

  function write(rel: string, source: string): string {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, source);
    return full;
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "repolinks-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("passes a tree where every tag matches its locale directory", () => {
    write("curso/es/01-a.mdx", lesson('<RepoLink tag="b5-l1">x</RepoLink>'));
    write("curso/en/01-a.mdx", lesson('<RepoLink tag="en-b5-l1">x</RepoLink>'));
    write("curso/en/02-b.mdx", lesson("No link here."));
    expect(() => validateRepoLinks(root)).not.toThrow();
  });

  it("throws on a Spanish tag in en/, naming the file", () => {
    write("curso/es/01-a.mdx", lesson('<RepoLink tag="b5-l1">x</RepoLink>'));
    const bad = write("curso/en/01-a.mdx", lesson('<RepoLink tag="b5-l1">x</RepoLink>'));
    expect(() => validateRepoLinks(root)).toThrow(bad);
  });

  it("throws on an English tag in es/, naming the file", () => {
    const bad = write("curso/es/01-a.mdx", lesson('<RepoLink tag="en-b5-l1" />'));
    expect(() => validateRepoLinks(root)).toThrow(bad);
  });

  it("ignores a `_`-prefixed template with placeholder tags", () => {
    write("curso/es/_template.mdx", lesson('<RepoLink tag="b5-lN-1">x</RepoLink>'));
    expect(() => validateRepoLinks(root)).not.toThrow();
  });

  it("passes the real content tree as it stands", () => {
    expect(() => validateRepoLinks()).not.toThrow();
  });
});
