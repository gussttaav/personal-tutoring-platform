/*
 * BLOG-01 — Raw MDX source loader for the blog reader.
 *
 * The registry (src/lib/blog/registry.ts) is deliberately METADATA-ONLY: it reads
 * frontmatter, never the prose body. The reader must actually render the prose — this
 * helper is the ONE place that reads a post's MDX body off disk, keeping that concern
 * out of the registry.
 *
 * Simpler than its course counterpart (src/lib/courses/lesson-source.ts): a post's
 * filename IS `<slug>.mdx`, so there is no `NN-` prefix to strip and no directory
 * scan — the path is computable. Runs at BUILD time on static routes only; no DB, ever.
 */

import fs from "node:fs";
import path from "node:path";

const CONTENT_ROOT = path.join(process.cwd(), "content", "blog");

/**
 * Return the raw MDX source (frontmatter included — `renderPost` strips it) for one
 * post, or `null` if the locale dir or the file does not exist. A missing locale is
 * normal, and yields `null` rather than a throw.
 */
export function getPostSource(slug: string, locale: string): string | null {
  // `slug` reaches here from `generateStaticParams` (registry-derived) or a dynamic
  // segment, so refuse anything that could climb out of the locale directory.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;

  const file = path.join(CONTENT_ROOT, locale, `${slug}.mdx`);
  if (!fs.existsSync(file)) return null;

  return fs.readFileSync(file, "utf8");
}
