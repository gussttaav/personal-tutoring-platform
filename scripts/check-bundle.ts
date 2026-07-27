/*
 * COURSE-P1-04 — Bundle guard.
 *
 * The whole point of the courses content pipeline is that KaTeX, Shiki, Pyodide and
 * the interactive widgets (P2) load ONLY on the lesson route — never on the home
 * page, the shared layout, or the course landing/catalog. That is a property nothing
 * enforces by itself: one stray top-level `import` in a shared component would quietly
 * ship megabytes to every page, and nobody would notice for months.
 *
 * This script is that enforcement. After `pnpm build`, it reads Next's per-route
 * bundle diagnostics and scans the first-load CLIENT JS of every route EXCEPT the
 * lesson route for the forbidden module signatures. First-load JS is exactly what
 * reaches the browser (and includes the shared layout + framework chunks), so a widget
 * — or a stray `import "katex"` — pulled into any shared surface lands in a scanned
 * chunk and fails the build here. Exit 1 names the offending marker, route, and chunk.
 *
 * Source of truth: `.next/diagnostics/route-bundle-stats.json` — the Next 16 App
 * Router per-route first-load chunk listing (`app-build-manifest.json` was removed).
 *
 * Run:  pnpm build && pnpm check:bundle
 * Verify it works: temporarily add `import "katex"` (or, once P2 lands, a
 * `@/features/courses/widgets/*` import) into src/app/[locale]/layout.tsx, rebuild →
 * this fails; revert.
 */

import fs from "node:fs";
import path from "node:path";

const STATS = path.join(process.cwd(), ".next", "diagnostics", "route-bundle-stats.json");

// Substrings that must never appear in a non-lesson first-load chunk. KaTeX, Shiki and
// Pyodide all emit their own name as runtime strings (class names, error text, loader
// URLs), so an accidental client import surfaces the marker even after minification.
const FORBIDDEN = ["katex", "shiki", "pyodide", "courses/widgets"];

// The single route allowed to carry the forbidden modules — matched by its dynamic
// lesson segment so a course-slug rename can't accidentally widen the exemption.
const LESSON_ROUTE_MARKER = "[lessonSlug]";

interface RouteStat {
  route: string;
  firstLoadChunkPaths: string[];
}

function fail(msg: string): never {
  console.error(`\n✖ bundle guard: ${msg}\n`);
  process.exit(1);
}

if (!fs.existsSync(STATS)) {
  fail(`${path.relative(process.cwd(), STATS)} not found — run \`pnpm build\` first.`);
}

const stats = JSON.parse(fs.readFileSync(STATS, "utf8")) as RouteStat[];

const violations: string[] = [];
// Cache chunk contents so shared chunks (referenced by many routes) are read once.
const chunkCache = new Map<string, string>();

function readChunk(chunk: string): string {
  let text = chunkCache.get(chunk);
  if (text === undefined) {
    // Chunk paths are project-root-relative (e.g. ".next/static/chunks/x.js").
    const abs = path.join(process.cwd(), chunk);
    text = abs.endsWith(".js") && fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
    chunkCache.set(chunk, text);
  }
  return text;
}

for (const { route, firstLoadChunkPaths } of stats) {
  if (route.includes(LESSON_ROUTE_MARKER)) continue; // the one allowed route

  for (const chunk of firstLoadChunkPaths ?? []) {
    const text = readChunk(chunk);
    if (!text) continue;
    for (const marker of FORBIDDEN) {
      if (text.includes(marker)) {
        violations.push(`  "${marker}" in ${chunk}  (route ${route})`);
      }
    }
  }
}

if (violations.length > 0) {
  fail(
    "forbidden heavy modules leaked off the lesson route:\n" +
      [...new Set(violations)].join("\n") +
      "\n\nKaTeX/Shiki/Pyodide/widgets must load ONLY on /cursos/[courseSlug]/[lessonSlug].",
  );
}

console.log("✓ bundle guard: no KaTeX/Shiki/Pyodide/widgets outside the lesson route");
