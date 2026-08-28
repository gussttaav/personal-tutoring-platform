/*
 * COURSE-P8-01 — the closed-state summary tally.
 *
 * This is the testable half of `LessonReading`: the block ships collapsed, so what the
 * summary says is the only thing most students ever see of the reading list. The repo
 * has no jsdom/RTL, so the component's markup is not rendered here (consistent with the
 * P2-02 / P3-01 notes in STATUS.md) — the ordering contract is.
 */

import type { ReadingItem } from "@/domain/types";
import { tallyKinds } from "../reading-summary";

function item(kind: ReadingItem["kind"], url: string): ReadingItem {
  return {
    kind,
    title:   `Título ${url}`,
    authors: "Autor",
    venue:   "venue",
    lang:    "en",
    url,
    note:    "Nota.",
  };
}

describe("tallyKinds", () => {
  it("returns [] for no entries", () => {
    expect(tallyKinds([])).toEqual([]);
  });

  it("counts one of each kind", () => {
    const tallies = tallyKinds([item("paper", "a"), item("libro", "b")]);
    expect(tallies).toEqual([
      { kind: "paper", count: 1 },
      { kind: "libro", count: 1 },
    ]);
  });

  it("groups repeats of the same kind", () => {
    const tallies = tallyKinds([item("paper", "a"), item("paper", "b"), item("video", "c")]);
    expect(tallies).toEqual([
      { kind: "paper", count: 2 },
      { kind: "video", count: 1 },
    ]);
  });

  it("omits kinds with no entries", () => {
    const tallies = tallyKinds([item("interactivo", "a")]);
    expect(tallies).toEqual([{ kind: "interactivo", count: 1 }]);
  });

  /*
   * The reason the tally is not built in encounter order: two lessons listing the same
   * mix must produce the same summary, or the difference reads as a bug.
   */
  it("orders by READING_KINDS, not by encounter order", () => {
    const shuffled = tallyKinds([item("interactivo", "a"), item("paper", "b"), item("libro", "c")]);
    expect(shuffled.map((t) => t.kind)).toEqual(["paper", "libro", "interactivo"]);
  });
});
