/* BLOG-27 — `<PostFigure id>` content lint. */

import { postFigureProblems } from "../validate-post-figures";

describe("postFigureProblems", () => {
  it("accepts a registered id", () => {
    expect(postFigureProblems('Texto.\n\n<PostFigure id="latency-budget" caption="Un turno." />\n')).toEqual([]);
  });

  it("flags an unknown id and names the valid ones", () => {
    const [problem] = postFigureProblems('<PostFigure id="latency-budjet" />');
    expect(problem).toContain('"latency-budjet"');
    expect(problem).toContain("latency-budget");
  });

  it("flags a missing id", () => {
    expect(postFigureProblems('<PostFigure caption="x" />')).toEqual(["<PostFigure> is missing an id attribute"]);
  });

  it("ignores a post without figures", () => {
    expect(postFigureProblems("<figure><img src=\"/a.svg\" alt=\"\" /></figure>")).toEqual([]);
  });
});
