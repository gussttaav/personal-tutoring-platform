/*
 * BLOG-05 — tests for the archive pane's pure shaping logic.
 * BLOG-13 — + `areas`/`tags` in the pane's entries, and the index's projection.
 */

import type { Post } from "@/domain/types";
import { toArchiveEntries, toIndexEntries } from "../archive-entries";

const post = (slug: string, date: string, minutes = 7): Post => ({
  slug,
  title: `Title ${slug}`,
  date,
  updated: date,
  minutes,
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
  areas: ["ia"],
  tags: ["llm"],
  cover: `/blog/${slug}/figura.svg`,
  aiImages: true,
});

describe("toArchiveEntries", () => {
  it("keeps only slug, title, date, minutes, areas and tags", () => {
    const [projected] = toArchiveEntries([post("a", "2026-09-15")]);
    expect(Object.keys(projected)).toEqual(["slug", "title", "date", "minutes", "areas", "tags"]);
    expect(projected).toEqual({
      slug: "a", title: "Title a", date: "2026-09-15", minutes: 7, areas: ["ia"], tags: ["llm"],
    });
  });

  it("returns [] for no posts", () => {
    expect(toArchiveEntries([])).toEqual([]);
  });

  it("puts the newest post first whatever the input order", () => {
    const entries = toArchiveEntries([
      post("jan26", "2026-01-05"),
      post("dec25", "2025-12-20"),
      post("sep26", "2026-09-15"),
    ]);
    expect(entries.map((e) => e.slug)).toEqual(["sep26", "jan26", "dec25"]);
  });

  it("orders across a year boundary by the full date, not the day", () => {
    const entries = toArchiveEntries([post("dec", "2025-12-31"), post("jan", "2026-01-01")]);
    expect(entries.map((e) => e.slug)).toEqual(["jan", "dec"]);
  });

  it("keeps the caller's order for posts sharing a date (stable)", () => {
    expect(
      toArchiveEntries([post("a", "2026-09-09"), post("b", "2026-09-09")]).map((e) => e.slug),
    ).toEqual(["a", "b"]);
    expect(
      toArchiveEntries([post("b", "2026-09-09"), post("a", "2026-09-09")]).map((e) => e.slug),
    ).toEqual(["b", "a"]);
  });

  it("does not mutate the input", () => {
    const posts = [post("old", "2025-01-01"), post("new", "2026-01-01")];
    toArchiveEntries(posts);
    expect(posts.map((p) => p.slug)).toEqual(["old", "new"]);
  });
});

describe("toIndexEntries", () => {
  it("adds the summary and cover to the pane's fields, never the reading list", () => {
    const [projected] = toIndexEntries([post("a", "2026-09-15")]);
    expect(projected).toEqual({
      slug: "a",
      title: "Title a",
      date: "2026-09-15",
      minutes: 7,
      areas: ["ia"],
      tags: ["llm"],
      summary: "A summary that must not reach the client.",
      cover: "/blog/a/figura.svg",
    });
  });

  it("omits the cover key for a post without one", () => {
    const { cover: _cover, ...noCover } = post("a", "2026-09-15");
    void _cover;
    const [projected] = toIndexEntries([noCover]);
    expect("cover" in projected).toBe(false);
  });

  it("puts the newest post first", () => {
    const entries = toIndexEntries([post("old", "2025-01-01"), post("new", "2026-01-01")]);
    expect(entries.map((e) => e.slug)).toEqual(["new", "old"]);
  });
});
