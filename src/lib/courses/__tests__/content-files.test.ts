/*
 * COURSE-P5-00 — Tests for the shared content walk.
 *
 * The `_` rule is the load-bearing part: `content/courses/dl-nlp/_template.mdx` is a
 * copy-paste starting point full of placeholders, and if the walk picked it up every
 * validator would fail on the very file that exists to help an author pass them.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { collectMdxFiles } from "../content-files";
import { explorableProblems, validateExplorableIds } from "../validate-explorables";

describe("collectMdxFiles", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "content-files-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function write(relative: string, source = "texto") {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, source, "utf8");
  }

  const names = (paths: string[]) => paths.map((p) => path.relative(root, p)).sort();

  it("recurses into course and locale directories", () => {
    write("dl-nlp/es/00-a.mdx");
    write("dl-nlp/en/00-a.mdx");
    expect(names(collectMdxFiles(root))).toEqual([
      path.join("dl-nlp", "en", "00-a.mdx"),
      path.join("dl-nlp", "es", "00-a.mdx"),
    ]);
  });

  it("ignores files that are not .mdx", () => {
    write("dl-nlp/course.es.yml");
    write("dl-nlp/es/00-a.mdx");
    expect(names(collectMdxFiles(root))).toEqual([path.join("dl-nlp", "es", "00-a.mdx")]);
  });

  it("skips `_`-prefixed files — templates are not lessons", () => {
    write("dl-nlp/_template.mdx");
    write("dl-nlp/es/00-a.mdx");
    expect(names(collectMdxFiles(root))).toEqual([path.join("dl-nlp", "es", "00-a.mdx")]);
  });

  it("skips `_`-prefixed directories — a scratch dir must not break CI", () => {
    write("dl-nlp/_drafts/wip.mdx");
    write("dl-nlp/es/00-a.mdx");
    expect(names(collectMdxFiles(root))).toEqual([path.join("dl-nlp", "es", "00-a.mdx")]);
  });

  it("returns [] for a content root that does not exist", () => {
    expect(collectMdxFiles(path.join(root, "missing"))).toEqual([]);
  });

  it("means a deliberately invalid template does not fail the lint", () => {
    const template = '<Explorable id="TODO-elige-un-widget" />';
    // Confirm the template WOULD be a hard error if it were ever walked…
    expect(explorableProblems(template)).toHaveLength(1);
    // …and that, named with the `_` prefix, it is not.
    write("dl-nlp/_template.mdx", template);
    expect(() => validateExplorableIds(root)).not.toThrow();
  });
});
