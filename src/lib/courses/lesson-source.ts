/*
 * COURSE-P1-04 — Raw MDX source loader for the lesson reader.
 *
 * The registry (src/lib/courses/registry.ts) is deliberately METADATA-ONLY: it
 * reads frontmatter and the manifest, never the prose body, so a future mobile API
 * stays additive. But the web reader must actually render the prose — this helper
 * is the ONE place that reads a lesson's MDX body off disk, keeping that concern
 * out of the registry.
 *
 * The registry API exposes a lesson by `slug` but not its filename (the `NN-`
 * order prefix is stripped during the scan), so we resolve the file by matching
 * the same "stem minus NN- prefix == slug" rule the registry enforces at build
 * time. Runs at BUILD time on static routes only; no DB, ever.
 */

import fs from "node:fs";
import path from "node:path";

const CONTENT_ROOT = path.join(process.cwd(), "content", "courses");

/**
 * Return the raw MDX source (frontmatter included — `renderLesson` strips it) for
 * one lesson, or `null` if the course/locale/lesson file does not exist. A missing
 * locale dir is normal (English has none for months) and yields `null`, not a throw.
 */
export function getLessonSource(
  courseSlug: string,
  lessonSlug: string,
  locale: string,
): string | null {
  const localeDir = path.join(CONTENT_ROOT, courseSlug, locale);
  if (!fs.existsSync(localeDir)) return null;

  const match = fs
    .readdirSync(localeDir)
    .find(
      (f) =>
        f.endsWith(".mdx") &&
        f.replace(/\.mdx$/, "").replace(/^\d+-/, "") === lessonSlug,
    );
  if (!match) return null;

  return fs.readFileSync(path.join(localeDir, match), "utf8");
}
