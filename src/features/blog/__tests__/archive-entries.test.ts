/*
 * BLOG-05 — tests for the archive pane's pure shaping logic.
 */

import type { Post } from "@/domain/types";
import { toArchiveEntries } from "../archive-entries";

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
  tags: ["llm"],
});

describe("toArchiveEntries", () => {
  it("keeps only slug, title, date and minutes", () => {
    const [projected] = toArchiveEntries([post("a", "2026-09-15")]);
    expect(Object.keys(projected)).toEqual(["slug", "title", "date", "minutes"]);
    expect(projected).toEqual({ slug: "a", title: "Title a", date: "2026-09-15", minutes: 7 });
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
