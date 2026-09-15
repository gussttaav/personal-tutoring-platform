/*
 * BLOG-05 — tests for the archive pane's pure shaping logic.
 */

import type { Post } from "@/domain/types";
import {
  toArchiveEntries,
  groupArchive,
  activeArchivePath,
  defaultOpenPath,
  capitaliseFirst,
  type ArchiveEntry,
} from "../archive-tree";

const entry = (slug: string, date: string, minutes = 5): ArchiveEntry => ({
  slug,
  title: `Title ${slug}`,
  date,
  minutes,
});

const post = (slug: string, date: string): Post => ({
  slug,
  title: `Title ${slug}`,
  date,
  updated: date,
  minutes: 7,
  summary: "A summary that must not reach the client.",
  draft: false,
  reading: [
    {
      kind: "paper",
      title: "Some paper",
      authors: "Someone",
      year: "2020",
      venue: "Somewhere",
      lang: "en",
      url: "https://example.com/paper",
      note: "Not for the client either.",
    },
  ],
  tags: ["llm"],
});

describe("toArchiveEntries", () => {
  it("keeps only slug, title, date and minutes", () => {
    const [projected] = toArchiveEntries([post("a", "2026-09-15")]);
    expect(Object.keys(projected)).toEqual(["slug", "title", "date", "minutes"]);
    expect(projected).toEqual({ slug: "a", title: "Title a", date: "2026-09-15", minutes: 7 });
  });

  it("preserves the input order", () => {
    const entries = toArchiveEntries([post("a", "2026-09-15"), post("b", "2026-09-09")]);
    expect(entries.map((e) => e.slug)).toEqual(["a", "b"]);
  });

  it("returns [] for no posts", () => {
    expect(toArchiveEntries([])).toEqual([]);
  });
});

describe("groupArchive", () => {
  it("returns [] for no entries", () => {
    expect(groupArchive([])).toEqual([]);
  });

  it("keys a single post by its year and its year-month", () => {
    const e = entry("a", "2026-09-15");
    expect(groupArchive([e])).toEqual([
      { key: "2026", months: [{ key: "2026-09", entries: [e] }] },
    ]);
  });

  it("orders years, months and entries newest first whatever the input order", () => {
    const dec25 = entry("dec25", "2025-12-20");
    const jan26 = entry("jan26", "2026-01-05");
    const sep15 = entry("sep15", "2026-09-15");
    const sep09 = entry("sep09", "2026-09-09");

    expect(groupArchive([sep09, dec25, sep15, jan26])).toEqual([
      {
        key: "2026",
        months: [
          { key: "2026-09", entries: [sep15, sep09] },
          { key: "2026-01", entries: [jan26] },
        ],
      },
      { key: "2025", months: [{ key: "2025-12", entries: [dec25] }] },
    ]);
  });

  it("keeps the caller's order for entries sharing a date (stable)", () => {
    const a = entry("a", "2026-09-09");
    const b = entry("b", "2026-09-09");
    expect(groupArchive([a, b])[0].months[0].entries).toEqual([a, b]);
    expect(groupArchive([b, a])[0].months[0].entries).toEqual([b, a]);
  });

  it("splits December and the following January into different years", () => {
    const years = groupArchive([entry("dec", "2025-12-31"), entry("jan", "2026-01-01")]);
    expect(years.map((y) => y.key)).toEqual(["2026", "2025"]);
  });

  it("does not mutate the input", () => {
    const input = [entry("old", "2025-01-01"), entry("new", "2026-01-01")];
    groupArchive(input);
    expect(input.map((e) => e.slug)).toEqual(["old", "new"]);
  });

  it("counts a month's entries", () => {
    const years = groupArchive([
      entry("a", "2026-09-15"),
      entry("b", "2026-09-09"),
      entry("c", "2026-09-01"),
    ]);
    expect(years[0].months[0].entries).toHaveLength(3);
  });
});

describe("activeArchivePath", () => {
  const years = groupArchive([
    entry("sep15", "2026-09-15"),
    entry("jan26", "2026-01-05"),
    entry("dec25", "2025-12-20"),
  ]);

  it("finds the year and month of the current post", () => {
    expect(activeArchivePath(years, "jan26")).toEqual({ year: "2026", month: "2026-01" });
  });

  it("finds a post in a year other than the first", () => {
    expect(activeArchivePath(years, "dec25")).toEqual({ year: "2025", month: "2025-12" });
  });

  it("is null for an unknown slug", () => {
    expect(activeArchivePath(years, "ghost")).toBeNull();
  });

  it("is null for an empty tree", () => {
    expect(activeArchivePath([], "sep15")).toBeNull();
  });
});

describe("defaultOpenPath", () => {
  const years = groupArchive([
    entry("sep15", "2026-09-15"),
    entry("jan26", "2026-01-05"),
    entry("dec25", "2025-12-20"),
  ]);

  it("is the current post's path when it is in the tree", () => {
    expect(defaultOpenPath(years, "dec25")).toEqual({ year: "2025", month: "2025-12" });
  });

  it("falls back to the newest year and month for an unknown slug", () => {
    expect(defaultOpenPath(years, "ghost")).toEqual({ year: "2026", month: "2026-09" });
  });

  it("is null for an empty tree", () => {
    expect(defaultOpenPath([], "sep15")).toBeNull();
  });
});

describe("capitaliseFirst", () => {
  it("upper-cases the first character of a lower-case Spanish month", () => {
    expect(capitaliseFirst("septiembre", "es")).toBe("Septiembre");
  });

  it("leaves an already capitalised label alone", () => {
    expect(capitaliseFirst("September", "en")).toBe("September");
  });

  it("returns the empty string unchanged", () => {
    expect(capitaliseFirst("", "es")).toBe("");
  });
});
