// COURSE-P2-01 — Content-lint tests for `<Explorable id>` validation.
//
// The pure helpers (findExplorables / explorableProblems) are tested against plain
// strings; the fs entry point (validateExplorableIds) is tested against a throwaway
// tree under os.tmpdir() so we can assert the thrown message names the file + id
// (mirrors registry.test.ts).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  findExplorables,
  explorableProblems,
  validateExplorableIds,
} from "@/lib/courses/validate-explorables";
import { WIDGET_IDS } from "@/features/courses/widgets/widget-ids";

// A guaranteed-valid id (the registry always has ≥1) and a guaranteed-invalid one.
const VALID_ID = WIDGET_IDS[0];
const BAD_ID = "definitely-not-a-widget";

describe("findExplorables", () => {
  it("extracts ids from self-closing and open tags", () => {
    const src = `
      text <Explorable id="${VALID_ID}" /> more
      <Explorable id='${BAD_ID}'></Explorable>
    `;
    expect(findExplorables(src)).toEqual([{ id: VALID_ID }, { id: BAD_ID }]);
  });

  it("reports a null id when the attribute is absent", () => {
    expect(findExplorables(`<Explorable caption="hi" />`)).toEqual([{ id: null }]);
  });

  it("returns [] when there is no Explorable", () => {
    expect(findExplorables("just prose and <Callout>x</Callout>")).toEqual([]);
  });
});

describe("explorableProblems", () => {
  it("is empty for a valid id", () => {
    expect(explorableProblems(`<Explorable id="${VALID_ID}" />`)).toEqual([]);
  });

  it("flags an unknown id", () => {
    const [problem] = explorableProblems(`<Explorable id="${BAD_ID}" />`);
    expect(problem).toContain(BAD_ID);
    expect(problem).toContain("unknown Explorable id");
  });

  it("flags a missing id", () => {
    expect(explorableProblems(`<Explorable />`)[0]).toContain("missing an id");
  });
});

describe("validateExplorableIds", () => {
  function tmpTree(mdxBody: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "explorable-lint-"));
    const dir = path.join(root, "dl-nlp", "es");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "00-lesson.mdx"), mdxBody, "utf8");
    return root;
  }

  it("passes when every Explorable id resolves", () => {
    const root = tmpTree(`# Lesson\n\n<Explorable id="${VALID_ID}" />\n`);
    expect(() => validateExplorableIds(root)).not.toThrow();
  });

  it("throws naming the file and the offending id", () => {
    const root = tmpTree(`# Lesson\n\n<Explorable id="${BAD_ID}" />\n`);
    expect(() => validateExplorableIds(root)).toThrow(
      new RegExp(`00-lesson\\.mdx: .*${BAD_ID}`),
    );
  });

  it("is a no-op when the content root does not exist", () => {
    expect(() =>
      validateExplorableIds(path.join(os.tmpdir(), "no-such-content-root-xyz")),
    ).not.toThrow();
  });
});
