/*
 * COURSE-C2-P3-01 — Content lint: a `<RepoLink tag>` matches its lesson's language.
 *
 * `<RepoLink>` points at a tag of the companion repository, and since D1 (2026-11-13) the
 * English code lives in the SAME repository, on an `en` branch with its own tags: the
 * Spanish lesson writes `tag="b5-l3"`, the English one `tag="en-b5-l3"`. The component and
 * `LLM_AGENTS_REPO_BASE` need no change for that, and that is exactly why the invariant
 * needs a check: an English lesson translated from the Spanish file keeps the Spanish tag
 * by default, and the link then serves Spanish code under English prose, silently.
 *
 * The pattern is selected by the lesson's LOCALE DIRECTORY (`lessonLocale`, as the voice
 * lint selects its families), one exported constant per locale, so a tenth lesson or a
 * third locale is one line. A locale with no pattern is not checked.
 *
 * FATAL, never a warning: a wrong tag is a broken lesson, not a style question.
 *
 * What it does NOT check: that the tag exists. It knows nothing about the repository (no
 * network); existence is the Block 5 clean-clone check. And it does NOT make the component
 * rewrite a tag by locale at render time: that would hide the slip this lint exists to
 * catch, and break the fallback page, where an untranslated lesson under `/en` is the
 * Spanish file, carries Spanish tags, and must link Spanish code. A `<RepoLink>` with no
 * `tag` attribute (a mention in an MDX comment, say) is not a link and is skipped.
 *
 * Node-clean like `validate-crosslinks.ts`: the pure helpers are unit-tested without the
 * disk, and `scripts/lint-content.ts` runs the fs pass.
 */

import fs from "node:fs";

import { DEFAULT_CONTENT_ROOT, collectMdxFiles } from "./content-files";
import { lessonLocale } from "./validate-voice";

/** The Spanish lessons' checkpoint tags: `b5-l1` … `b5-l9`. */
export const REPO_TAG_ES = /^b5-l[1-9]$/;
/** The English lessons' checkpoint tags, on `agente-minimo`'s `en` branch (D1). */
export const REPO_TAG_EN = /^en-b5-l[1-9]$/;

/** The tag shape each locale directory must use. A locale missing here is not checked. */
export const REPO_TAG_BY_LOCALE: Readonly<Record<string, RegExp>> = {
  es: REPO_TAG_ES,
  en: REPO_TAG_EN,
};

// Matches a <RepoLink …> opening tag and captures its attribute text. `\b` keeps
// `<RepoLinkCard>`-style names out; `</RepoLink>` cannot match.
const REPOLINK_TAG = /<RepoLink\b([^>]*?)\/?>/g;
// `\b` before `tag` keeps it from matching inside another attribute's name.
const TAG_ATTR = /\btag\s*=\s*["']([^"']*)["']/;
const FENCE = /^\s*(`{3,}|~{3,})/;

/** The fence-tracking idiom of validate-crosslinks.ts / headings.ts: a fenced sample is not a link. */
function withoutFences(source: string): string {
  const lines: string[] = [];
  let fence: string | null = null;
  for (const line of source.split("\n")) {
    const fenceMatch = line.match(FENCE);
    if (fenceMatch) {
      const marker = fenceMatch[1][0].repeat(3);
      if (fence === null) fence = marker;
      else if (marker === fence) fence = null;
      continue;
    }
    if (fence === null) lines.push(line);
  }
  return lines.join("\n");
}

/** Every `<RepoLink tag>` value in a lesson source, in source order. */
export function findRepoTags(source: string): string[] {
  const tags: string[] = [];
  for (const match of withoutFences(source).matchAll(REPOLINK_TAG)) {
    const tag = (match[1] ?? "").match(TAG_ATTR);
    if (tag) tags.push(tag[1]);
  }
  return tags;
}

/**
 * Human-readable problems for one lesson source in `locale`. Empty array = every tag has
 * the locale's shape (or the locale has none to check). Pure — no filesystem.
 */
export function repoLinkProblems(source: string, locale: string): string[] {
  const pattern = REPO_TAG_BY_LOCALE[locale];
  if (!pattern) return [];
  return findRepoTags(source)
    .filter((tag) => !pattern.test(tag))
    .map((tag) => `<RepoLink tag="${tag}"> in a "${locale}" lesson must match ${pattern.source}`);
}

/**
 * Validate every `<RepoLink tag>` under `contentRoot`, throwing on the first offending
 * file (`${filePath}: <problem>`). No content → no-op.
 */
export function validateRepoLinks(contentRoot: string = DEFAULT_CONTENT_ROOT): void {
  for (const filePath of collectMdxFiles(contentRoot)) {
    const source = fs.readFileSync(filePath, "utf8");
    const problems = repoLinkProblems(source, lessonLocale(filePath));
    if (problems.length > 0) {
      throw new Error(`${filePath}: ${problems[0]}`);
    }
  }
}
