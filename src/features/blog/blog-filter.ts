/*
 * BLOG-13 — what the blog's two filtered lists show: the index (`BlogIndex`) and the
 * archive pane beside a post (`PostArchive`).
 *
 * Pure, like `archive-entries.ts` beside it, so the decisions are tested without a DOM:
 *
 *   normalizeFilter  — a raw `{ area, topic }` (from the URL or sessionStorage, so
 *                      untrusted) → a filter that exists: an unknown area, or one no post
 *                      names, is "all"; a topic no post in that area carries is none.
 *   filterEntries    — the entries a filter keeps, order preserved.
 *   shownArea        — which of a post's areas its card or list dot shows.
 *   areaCounts       — the area filter's options: every area some entry names, in
 *                      `BLOG_AREAS` order. An area with no post never shows.
 *   topicCounts      — the topic filter's options inside an area, most-used first.
 *   indexPage        — one page of the index: the newest post FEATURED on page 1 of
 *                      the unfiltered view, then `pageSize` cards per page.
 *   archivePage      — one page of the pane; with no page asked for, the page that
 *                      holds the post being read.
 *   pageNumbers      — the pager's buttons, with gaps once there are more than seven.
 *   parseIndexParams / indexSearch — the index's URL (`?area=&topic=&page=`), both ways.
 *
 * Entries are generic over the two fields filtering reads, so the index (with
 * summaries and covers) and the pane (titles only) share one implementation.
 */

import { BLOG_AREAS, BLOG_TOPICS } from "@/constants/blog";
import type { BlogArea, BlogTopic } from "@/domain/types";

export type AreaFilter = BlogArea | "all";

export interface BlogFilter {
  area:  AreaFilter;
  topic: BlogTopic | null;
}

export const NO_FILTER: BlogFilter = { area: "all", topic: null };

/** The two fields filtering reads. */
export interface Classified {
  areas: readonly BlogArea[];
  tags:  readonly BlogTopic[];
}

const isArea = (v: unknown): v is BlogArea =>
  typeof v === "string" && (BLOG_AREAS as readonly string[]).includes(v);

const isTopic = (v: unknown): v is BlogTopic =>
  typeof v === "string" && (BLOG_TOPICS as readonly string[]).includes(v);

const inArea = <T extends Classified>(entries: readonly T[], area: AreaFilter): T[] =>
  area === "all" ? [...entries] : entries.filter((e) => e.areas.includes(area));

export function normalizeFilter(
  entries: readonly Classified[],
  raw: { area?: unknown; topic?: unknown },
): BlogFilter {
  const area: AreaFilter =
    isArea(raw.area) && entries.some((e) => e.areas.includes(raw.area as BlogArea))
      ? raw.area
      : "all";
  const scoped = inArea(entries, area);
  const topic =
    isTopic(raw.topic) && scoped.some((e) => e.tags.includes(raw.topic as BlogTopic))
      ? raw.topic
      : null;
  return { area, topic };
}

/** The area an entry is labelled with: the filtered area when the entry is in it (a
 *  post in two areas must not read as off-filter), else its first, primary one. */
export function shownArea(entry: Classified, filter: BlogFilter): BlogArea {
  return filter.area !== "all" && entry.areas.includes(filter.area) ? filter.area : entry.areas[0];
}

export function isFiltered(filter: BlogFilter): boolean {
  return filter.area !== "all" || filter.topic !== null;
}

export function filterEntries<T extends Classified>(entries: readonly T[], filter: BlogFilter): T[] {
  return inArea(entries, filter.area).filter((e) => !filter.topic || e.tags.includes(filter.topic));
}

export function areaCounts(entries: readonly Classified[]): Array<{ area: BlogArea; count: number }> {
  return BLOG_AREAS.map((area) => ({
    area,
    count: entries.filter((e) => e.areas.includes(area)).length,
  })).filter((a) => a.count > 0);
}

/**
 * Topics carried by the entries in `area`, most-used first; ties by `labelOf` (the
 * locale's label, so the order reads alphabetically in each language), else by id.
 */
export function topicCounts(
  entries: readonly Classified[],
  area: AreaFilter,
  labelOf?: (topic: BlogTopic) => string,
): Array<{ topic: BlogTopic; count: number }> {
  const counts = new Map<BlogTopic, number>();
  for (const e of inArea(entries, area)) {
    for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const tie = (a: BlogTopic, b: BlogTopic) =>
    labelOf ? labelOf(a).localeCompare(labelOf(b)) : a.localeCompare(b);
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || tie(a.topic, b.topic));
}

export interface IndexPage<T> {
  /** The newest post, on page 1 of the unfiltered view only. */
  featured:  T | null;
  /** The grid's cards on this page. */
  items:     T[];
  /** Clamped to `1..pageCount`. */
  page:      number;
  pageCount: number;
  /** Posts the filter keeps, featured included. */
  total:     number;
  /** 1-based positions of the first and last post on this page, featured included
   *  (`0`/`0` for an empty list), for the "Artículos 1–7 de 8" line. */
  first:     number;
  last:      number;
}

/**
 * One page of the index. The featured post is page 1's EXTRA, not one of its cards:
 * the grid pages through the posts after it, `pageSize` at a time, so every page's
 * grid is full until the last one. A filtered view has no featured post; the reader
 * asked for a subset, and the newest of it is simply its first card.
 */
export function indexPage<T>(
  list: readonly T[],
  filtered: boolean,
  requestedPage: number,
  pageSize: number,
): IndexPage<T> {
  const featuredOn = !filtered && list.length > 0;
  const rest = featuredOn ? list.slice(1) : [...list];
  const pageCount = Math.max(1, Math.ceil(rest.length / pageSize));
  const page = clampPage(requestedPage, pageCount);
  const start = (page - 1) * pageSize;
  const items = rest.slice(start, start + pageSize);
  const featured = featuredOn && page === 1 ? list[0] : null;
  const offset = featuredOn ? 1 : 0;
  const total = list.length;
  const first = total === 0 ? 0 : featured ? 1 : start + 1 + offset;
  const last = total === 0 ? 0 : start + items.length + offset;
  return { featured, items, page, pageCount, total, first, last };
}

/**
 * One page of the archive pane. `requestedPage === null` means "wherever the post
 * being read is" — the page a post opens on — and page 1 when the filter hides it.
 */
export function archivePage<T extends { slug: string }>(
  list: readonly T[],
  currentSlug: string,
  requestedPage: number | null,
  pageSize: number,
): { items: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const at = list.findIndex((e) => e.slug === currentSlug);
  const auto = at >= 0 ? Math.floor(at / pageSize) + 1 : 1;
  const page = clampPage(requestedPage ?? auto, pageCount);
  const start = (page - 1) * pageSize;
  return { items: list.slice(start, start + pageSize), page, pageCount };
}

function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), pageCount);
}

/** The pager's numbered buttons. Up to seven pages, all of them; beyond that, the first,
 *  the last and the current one's neighbours, with `"gap"` where pages are skipped. */
export function pageNumbers(current: number, pageCount: number): Array<number | "gap"> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: Array<number | "gap"> = [1];
  const lo = Math.max(2, current - 1);
  const hi = Math.min(pageCount - 1, current + 1);
  if (lo > 2) out.push("gap");
  for (let n = lo; n <= hi; n++) out.push(n);
  if (hi < pageCount - 1) out.push("gap");
  out.push(pageCount);
  return out;
}

/** The index's raw URL state. Values are untrusted: `normalizeFilter` and `indexPage`
 *  decide what survives. */
export function parseIndexParams(params: { get(name: string): string | null }): {
  area: string | null;
  topic: string | null;
  page: number;
} {
  const page = Number.parseInt(params.get("page") ?? "", 10);
  return {
    area:  params.get("area"),
    topic: params.get("topic"),
    page:  Number.isFinite(page) && page >= 1 ? page : 1,
  };
}

/** `?area=…&topic=…&page=…`, defaults omitted; `""` for the plain index. */
export function indexSearch(filter: BlogFilter, page: number): string {
  const qs = new URLSearchParams();
  if (filter.area !== "all") qs.set("area", filter.area);
  if (filter.topic) qs.set("topic", filter.topic);
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return s ? `?${s}` : "";
}
