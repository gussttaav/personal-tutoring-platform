"use client";

/*
 * COURSE-P11-02 — "has this browser loaded the Python interpreter before?"
 *
 * Pyodide (~15 MB) is fetched from jsDelivr at a version-pinned URL that never changes,
 * so it lands in the browser's HTTP cache and the SECOND lesson a student runs code on
 * reads it from disk, not the network — one copy, shared across every lesson and visit
 * (this is exactly what `firstRunNote` promises). But the worker still emits a `runtime`
 * loading stage while it instantiates the wasm, and labelling that "Descargando el
 * intérprete…" made a fast cache read look like a fresh 15 MB download.
 *
 * This flag is the cue for the UI to say "desde la caché" instead. It is a HINT, not a
 * guarantee: the HTTP cache can be evicted under storage pressure while this key
 * survives, in which case one progress line is mislabelled and the load is simply
 * slower than it implies. That is a cheap thing to be wrong about — cheaper than
 * intercepting Pyodide's own wasm fetch to know for certain.
 *
 * `localStorage`, not `sessionStorage`: the case that matters is the return visit and
 * the fresh tab, not just SPA navigation within one session.
 */

const KEY = "gt:pyodide-loaded";

/** True once `markInterpreterLoaded()` has run in this browser. */
export function hasLoadedInterpreterBefore(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    // Private mode / storage disabled — the progress line stays on the cold-load copy.
    return false;
  }
}

/** Record that the interpreter finished loading, so later lessons can say "from cache". */
export function markInterpreterLoaded(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Storage unavailable — every load is then labelled as a cold download. Harmless.
  }
}
