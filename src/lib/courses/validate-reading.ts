/*
 * COURSE-P8-01 — Content lint for the frontmatter `reading` array.
 *
 * Unlike its five siblings this one validates NO body reference: "Para profundizar"
 * has no `<Tag id="…" />`, because the block is rendered from frontmatter by
 * LessonReading.tsx rather than placed by the author. So the id-resolution these
 * passes usually do has no analogue here, and everything checkable about SHAPE
 * (kinds, the cap of five, note length, https, duplicate urls) is already done by
 * `ReadingItemSchema` in `validateAllContent`, which runs first.
 *
 * What is left is the house rules a Zod schema cannot express — all three of them
 * about links that are wrong in a way nobody notices until a student clicks:
 *
 *   1. an arXiv link must be the ABSTRACT page, not the PDF. `/pdf/` hands a phone a
 *      2 MB download instead of a page, and the abstract is the stable address —
 *      it survives new versions, and it is the one that links on to the PDF, the
 *      HTML render and the citation.
 *   2. a `venue` that names an arXiv id must AGREE with the url's id. This catches the
 *      copy-paste that updates the title and the venue but leaves the previous entry's
 *      link — the failure mode that ships a confidently-labelled wrong paper.
 *   3. the same title twice in one lesson. The schema rejects a duplicate URL, which
 *      misses the same source listed twice under two addresses (abs vs. doi).
 *
 * Node-clean and pure like its siblings: helpers take a source string and return
 * problems, `scripts/lint-content.ts` runs the filesystem pass in CI.
 */

import fs from "node:fs";

import matter from "gray-matter";

import { DEFAULT_CONTENT_ROOT, collectMdxFiles } from "./content-files";

/** `arxiv.org/abs/1301.3781`, `arxiv.org/pdf/1301.3781v3` — captures kind + id. */
const ARXIV_URL = /arxiv\.org\/(abs|pdf)\/([^\s?#]+)/i;
/** A `venue` written as `arXiv:1301.3781`. */
const ARXIV_VENUE = /arxiv:\s*([0-9]{4}\.[0-9]{4,5})/i;

interface RawReadingItem {
  title?: unknown;
  venue?: unknown;
  url?:   unknown;
}

/**
 * The `reading` entries as written, without re-validating shape. Entries that are not
 * objects are skipped rather than reported: the Zod schema already rejected those.
 */
export function frontmatterReading(source: string): RawReadingItem[] {
  const { data } = matter(source);
  const reading = data.reading;
  if (!Array.isArray(reading)) return [];
  return reading.filter((item): item is RawReadingItem => !!item && typeof item === "object");
}

/** Strip an arXiv id of its version suffix, so `1301.3781v3` and `1301.3781` agree. */
function bareArxivId(id: string): string {
  return id.replace(/v\d+$/i, "");
}

/**
 * Human-readable problems for one lesson source. Empty array = consistent.
 * Pure — no filesystem — so it is trivially unit-testable.
 */
export function readingProblems(source: string): string[] {
  const problems: string[] = [];
  const items = frontmatterReading(source);

  const seenTitles = new Set<string>();
  for (const item of items) {
    const title = typeof item.title === "string" ? item.title : "";
    const venue = typeof item.venue === "string" ? item.venue : "";
    const url   = typeof item.url === "string" ? item.url : "";

    const urlMatch = url.match(ARXIV_URL);
    if (urlMatch) {
      if (urlMatch[1].toLowerCase() === "pdf") {
        problems.push(
          `reading "${title}" links to the arXiv PDF — use the /abs/ page instead (${url})`,
        );
      }

      const venueMatch = venue.match(ARXIV_VENUE);
      if (venueMatch && bareArxivId(urlMatch[2]) !== bareArxivId(venueMatch[1])) {
        problems.push(
          `reading "${title}" says venue ${venue} but links to arXiv id ${urlMatch[2]} — one of the two is stale`,
        );
      }
    }

    const key = title.trim().toLowerCase();
    if (key && seenTitles.has(key)) {
      problems.push(`reading "${title}" is listed twice in this lesson`);
    }
    seenTitles.add(key);
  }

  return problems;
}

/**
 * Validate the `reading` array of every lesson under `contentRoot`, throwing on the
 * first offending file (`${filePath}: <problem>`).
 *
 * NB: link LIVENESS is deliberately not checked. CI has no network guarantee, and a
 * lint that fails because someone else's server is down is a lint people disable.
 * Rot is a periodic manual pass, not a build gate.
 */
export function validateReading(contentRoot: string = DEFAULT_CONTENT_ROOT): void {
  for (const filePath of collectMdxFiles(contentRoot)) {
    const source = fs.readFileSync(filePath, "utf8");
    const problems = readingProblems(source);
    if (problems.length > 0) {
      throw new Error(`${filePath}: ${problems[0]}`);
    }
  }
}
