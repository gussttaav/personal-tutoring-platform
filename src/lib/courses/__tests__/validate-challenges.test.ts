/*
 * COURSE-P3-02 — Tests for the `<CodeChallenge id>` ⇄ frontmatter content lint.
 *
 * Same shape as the quiz lint, same reason: the challenge lives in frontmatter and is
 * placed in the prose by id, so a typo compiles fine and renders nothing at all in
 * production. It has to fail the lint instead — and stay quiet about the cases the
 * P1-02/P3-02 Zod schemas already own.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  challengeProblems,
  findChallengeRefs,
  frontmatterChallengeIds,
  validateChallengeRefs,
} from "../validate-challenges";

function lesson({ ids = [] as string[], body = "" }): string {
  const challenges =
    ids.length === 0
      ? "challenges: []"
      : `challenges:\n${ids
          .map(
            (id) =>
              `  - id: ${id}\n    prompt: "p"\n    starter: "pass"\n    tests:\n      - name: "t"\n        code: "assert True"\n    solution: "pass"\n    explanation: "e"`,
          )
          .join("\n")}`;

  return `---
slug: demo
title: "Demo"
hasCode: ${ids.length > 0}
${challenges}
---

${body}
`;
}

describe("findChallengeRefs", () => {
  it("finds a self-closing tag and captures the id", () => {
    expect(findChallengeRefs('<CodeChallenge id="ch1" />')).toEqual([{ id: "ch1" }]);
  });

  it("finds tags spread over several lines, in source order", () => {
    expect(
      findChallengeRefs('<CodeChallenge\n  id="ch1"\n/>\n\ntexto\n\n<CodeChallenge id="ch2" />'),
    ).toEqual([{ id: "ch1" }, { id: "ch2" }]);
  });

  it("reports a missing id as null rather than skipping the tag", () => {
    expect(findChallengeRefs("<CodeChallenge />")).toEqual([{ id: null }]);
  });

  it("does not match a longer component name", () => {
    expect(findChallengeRefs('<CodeChallengeCard id="ch1" />')).toEqual([]);
  });

  it("is empty for prose with no challenge", () => {
    expect(findChallengeRefs("Sólo texto con `código`.")).toEqual([]);
  });
});

describe("frontmatterChallengeIds", () => {
  it("reads the declared ids in order", () => {
    expect(frontmatterChallengeIds(lesson({ ids: ["ch1", "ch2"] }))).toEqual(["ch1", "ch2"]);
  });

  it("is empty for an empty challenge list", () => {
    expect(frontmatterChallengeIds(lesson({}))).toEqual([]);
  });
});

describe("challengeProblems", () => {
  it("accepts a lesson whose ids all resolve", () => {
    expect(
      challengeProblems(
        lesson({ ids: ["ch1", "ch2"], body: '<CodeChallenge id="ch1" />\n\n<CodeChallenge id="ch2" />' }),
      ),
    ).toEqual([]);
  });

  it("accepts a declared challenge that is not placed yet", () => {
    expect(challengeProblems(lesson({ ids: ["ch1", "ch2"], body: '<CodeChallenge id="ch1" />' }))).toEqual(
      [],
    );
  });

  it("accepts prose with no challenge at all", () => {
    expect(challengeProblems(lesson({ body: "Sólo texto." }))).toEqual([]);
  });

  it("rejects an id with no matching challenge, naming the declared ids", () => {
    const problems = challengeProblems(lesson({ ids: ["ch1"], body: '<CodeChallenge id="ch-typo" />' }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/ch-typo/);
    expect(problems[0]).toMatch(/declared ids: ch1/);
  });

  it("rejects a challenge in a lesson that declares none", () => {
    expect(challengeProblems(lesson({ body: '<CodeChallenge id="ch1" />' }))[0]).toMatch(
      /declares no challenges/,
    );
  });

  it("rejects a missing id attribute", () => {
    expect(challengeProblems(lesson({ ids: ["ch1"], body: "<CodeChallenge />" }))[0]).toMatch(
      /missing an id/,
    );
  });

  it("rejects the same challenge placed twice — attempts would be ambiguous", () => {
    const problems = challengeProblems(
      lesson({ ids: ["ch1"], body: '<CodeChallenge id="ch1" />\n\n<CodeChallenge id="ch1" />' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/more than once/);
  });
});

describe("validateChallengeRefs", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "challenge-lint-"));
    fs.mkdirSync(path.join(root, "demo", "es"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function write(name: string, source: string) {
    fs.writeFileSync(path.join(root, "demo", "es", name), source, "utf8");
  }

  it("passes when every reference resolves", () => {
    write("00-a.mdx", lesson({ ids: ["ch1"], body: '<CodeChallenge id="ch1" />' }));
    write("01-b.mdx", lesson({ body: "Sólo texto." }));
    expect(() => validateChallengeRefs(root)).not.toThrow();
  });

  it("throws naming the offending file", () => {
    write("00-a.mdx", lesson({ ids: ["ch1"], body: '<CodeChallenge id="ch1" />' }));
    write("01-b.mdx", lesson({ ids: ["ch1"], body: '<CodeChallenge id="nope" />' }));
    expect(() => validateChallengeRefs(root)).toThrow(/01-b\.mdx: .*nope/);
  });

  it("is a no-op when the content root does not exist", () => {
    expect(() => validateChallengeRefs(path.join(root, "missing"))).not.toThrow();
  });
});
