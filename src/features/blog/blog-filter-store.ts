/*
 * BLOG-13 — the blog filter the reader last chose, for the length of the tab.
 *
 * The archive pane beside a post remounts on every post (it is keyed by slug), so a
 * filter chosen in it would be lost on the next click. It lives here instead, in
 * sessionStorage: the pane reads it and writes it, and the index writes the filter it
 * is showing, so a reader who filters "Bases de datos" on /blog and opens a post finds
 * the pane already narrowed to it.
 *
 * Read through `useSyncExternalStore`: the server snapshot is "no filter", so hydration
 * matches the prerendered HTML and the stored filter applies right after; a client-side
 * navigation mounts with the stored value directly, so moving between posts never
 * flashes the unfiltered list.
 *
 * The stored value is RAW (it may name an area that no longer exists): callers pass it
 * through `normalizeFilter`. Every storage access is guarded — a private window or
 * blocked site data falls back to an in-memory copy for the page's lifetime.
 */

import { useSyncExternalStore } from "react";

const KEY = "blog:filter";

export interface StoredBlogFilter {
  area:  string;
  topic: string | null;
}

const DEFAULT: StoredBlogFilter = { area: "all", topic: null };

const listeners = new Set<() => void>();
let memory: StoredBlogFilter | null = null;
let cache: { raw: string | null; value: StoredBlogFilter } = { raw: null, value: DEFAULT };

function parse(raw: string): StoredBlogFilter {
  try {
    const v = JSON.parse(raw) as Partial<StoredBlogFilter>;
    return {
      area:  typeof v.area === "string" ? v.area : "all",
      topic: typeof v.topic === "string" ? v.topic : null,
    };
  } catch {
    return DEFAULT;
  }
}

function getSnapshot(): StoredBlogFilter {
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(KEY);
  } catch {
    return memory ?? DEFAULT;
  }
  // Same string → same object, as useSyncExternalStore requires.
  if (raw !== cache.raw) cache = { raw, value: raw === null ? DEFAULT : parse(raw) };
  return cache.value;
}

function getServerSnapshot(): StoredBlogFilter {
  return DEFAULT;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setStoredBlogFilter(filter: StoredBlogFilter): void {
  const next = { area: filter.area, topic: filter.topic };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    memory = next;
  }
  for (const listener of listeners) listener();
}

export function useStoredBlogFilter(): StoredBlogFilter {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
