/*
 * COURSE-P9-01 — Scoring and ordering. The heart of the feature.
 *
 * Pure, isomorphic, DOM-free — the whole reason this logic is not inside the dialog
 * component. `pnpm test:unit` runs in the `node` environment with no jsdom and no RTL
 * (jest.config.js), so anything that must be tested has to live in a module like this
 * one. Same discipline as reader/scroll-spy.ts and quiz/state.ts.
 *
 * `search()` takes ONE prepared index. Search is scoped to the course the reader is
 * already inside, which is the only surface that offers it; there is no cross-course
 * mode. Nothing here knows the name of any particular course, so a second course gets
 * search with no code change.
 *
 * PERFORMANCE, measured against the real corpus (254 chunks, 416 KB of prose):
 *   normalize the whole corpus once, at load:  ~10 ms
 *   one-term AND scan, per keystroke:          0.1–0.6 ms
 *   three-term AND scan:                       0.65 ms
 *   worst case (all 8,413 hits of "de"):       0.91 ms
 * Two orders of magnitude under a 60 fps frame, on a desktop; still ~5 ms on a phone.
 * ESCALATION LADDER, if a future corpus ever crosses ~10 ms — take these in order and
 * stop as soon as it is fast enough. Do NOT skip to the bottom:
 *   1. Stop scanning a lesson's chunks once it already has MAX_SECTIONS_PER_LESSON hits.
 *   2. Bucket chunk indexes by their first two characters at prepare time.
 *   3. Only then, a real inverted index.
 */

import { extendToWordEnd, findTerm, hasTerm, isWholeWord, mergeRanges, type Range } from "./match";
import { normalizeAligned } from "./normalize";
import { parseQuery } from "./query";
import { SEARCH_INDEX_VERSION, type SearchChunkEntry, type SearchIndex, type SearchLessonEntry } from "./types";

export type SearchField = "title" | "heading" | "summary" | "body";

/** A hit in the lesson title is worth twelve in the body. Tuned, not derived. */
export const FIELD_WEIGHT: Record<SearchField, number> = {
  title:   12,
  heading:  6,
  summary:  3,
  body:     1,
};

const PHRASE_BONUS      = 25;
const PROXIMITY_BONUS   = 5;
const PROXIMITY_WINDOW  = 160;
const WHOLE_WORD_BONUS  = 3;
const FREQUENCY_WEIGHT  = 0.5;
const FREQUENCY_CAP     = 3;
/** Belt to `MAX_RANGES_PER_TERM`'s braces. With bounded collection this is unreachable
 *  in practice; it stays so the min-window scan can never become the hot spot again. */
const PROXIMITY_MATCH_BUDGET = 500;

/** Sections shown per lesson. Beyond this, the row reports "+N more". */
export const MAX_SECTIONS_PER_LESSON = 3;
/** Lessons shown. With up to 3 sections each this is a comfortably scrollable list. */
export const MAX_LESSONS = 10;

export interface PreparedLesson extends SearchLessonEntry {
  normTitle:   string;
  normSummary: string;
}

export interface PreparedChunk extends SearchChunkEntry {
  normText:    string;
  normHeading: string;
}

export interface PreparedIndex {
  course:  string;
  locale:  string;
  lessons: PreparedLesson[];
  chunks:  PreparedChunk[];
  /** Chunk indexes grouped by lesson index, in document order. */
  byLesson: number[][];
}

export interface SearchMatch {
  /** Index into `PreparedIndex.chunks`. */
  chunk:       number;
  headingId:   string;
  headingText: string;
  score:       number;
  /** Offsets into the chunk's ORIGINAL text — what the snippet highlights. */
  ranges:      Range[];
  /** Offsets into `headingText`, so the breadcrumb can be highlighted too. */
  headingRanges: Range[];
}

export interface SearchResult {
  course:  string;
  locale:  string;
  lesson:  SearchLessonEntry;
  score:   number;
  /** Offsets into `lesson.title`, so a title hit is visibly a title hit. */
  titleRanges: Range[];
  /** Best first, capped at MAX_SECTIONS_PER_LESSON. */
  matches: SearchMatch[];
  /** Matching sections beyond the cap — drives the "+N more" affordance. */
  extraSections: number;
}

/** Thrown when the served index is a shape this build does not understand. */
export class SearchIndexVersionError extends Error {
  constructor(got: unknown) {
    super(`search index version ${String(got)} is not supported (expected ${SEARCH_INDEX_VERSION})`);
    this.name = "SearchIndexVersionError";
  }
}

/**
 * Attach normalized copies once, after the index is fetched. ~10 ms for the whole corpus.
 * Never do this per keystroke.
 */
export function prepareIndex(index: SearchIndex): PreparedIndex {
  if (index?.version !== SEARCH_INDEX_VERSION) throw new SearchIndexVersionError(index?.version);

  const byLesson: number[][] = index.lessons.map(() => []);
  index.chunks.forEach((chunk, i) => {
    if (byLesson[chunk.lesson]) byLesson[chunk.lesson].push(i);
  });

  return {
    course:  index.course,
    locale:  index.locale,
    lessons: index.lessons.map((l) => ({
      ...l,
      normTitle:   normalizeAligned(l.title),
      normSummary: normalizeAligned(l.summary),
    })),
    chunks: index.chunks.map((c) => ({
      ...c,
      normText:    normalizeAligned(c.text),
      normHeading: normalizeAligned(c.headingText),
    })),
    byLesson,
  };
}

/** Do all needles occur inside one `PROXIMITY_WINDOW`-wide span? Classic min-window. */
function hasProximity(perNeedle: Range[][]): boolean {
  const needles = perNeedle.length;
  if (needles < 2) return false;
  const total = perNeedle.reduce((n, r) => n + r.length, 0);
  if (total === 0 || total > PROXIMITY_MATCH_BUDGET) return false;

  const flat: { start: number; needle: number }[] = [];
  perNeedle.forEach((ranges, needle) => ranges.forEach((r) => flat.push({ start: r.start, needle })));
  flat.sort((a, b) => a.start - b.start);

  const seen = new Array<number>(needles).fill(0);
  let covered = 0;
  let left = 0;
  for (const item of flat) {
    if (seen[item.needle]++ === 0) covered++;
    while (covered === needles) {
      if (item.start - flat[left].start <= PROXIMITY_WINDOW) return true;
      if (--seen[flat[left].needle] === 0) covered--;
      left++;
    }
  }
  return false;
}

/** The lesson's opening section, as a single scoreless row for a title-only match. */
function headFallback(index: PreparedIndex, lessonIndex: number): SearchMatch[] {
  const ci = (index.byLesson[lessonIndex] ?? [])[0];
  if (ci === undefined) return [];
  const chunk = index.chunks[ci];
  return [{
    chunk: ci,
    headingId: chunk.headingId,
    headingText: chunk.headingText,
    score: FIELD_WEIGHT.title,
    ranges: [],
    headingRanges: [],
  }];
}

interface SearchOptions {
  maxLessons?: number;
}

/**
 * Rank every lesson in every index against `raw`.
 *
 * A SECTION matches when every needle is present in it, counting the lesson's own title
 * and summary as satisfying a needle for all of that lesson's sections — otherwise a
 * query naming the lesson plus a detail ("backpropagation chain rule") would match
 * nothing, because the title words appear in no section body.
 *
 * A LESSON matches when any of its sections does.
 */
export function search(
  index: PreparedIndex,
  raw: string,
  opts: SearchOptions = {},
): SearchResult[] {
  const q = parseQuery(raw);
  if (q.empty) return [];

  const needles = [...q.terms, ...q.phrases];
  const phraseStart = q.terms.length;
  const results: SearchResult[] = [];

  index.lessons.forEach((lesson, li) => {
    // Lesson-level fields satisfy the AND test for every one of this lesson's sections.
    const lessonHit = needles.map((n) => {
      if (findTerm(lesson.normTitle, n).length > 0) return FIELD_WEIGHT.title;
      if (findTerm(lesson.normSummary, n).length > 0) return FIELD_WEIGHT.summary;
      return 0;
    });

    const matches: SearchMatch[] = [];
    /** Did any section pass the AND gate, even with nothing of its own to show? */
    let anyGatePass = false;

    for (const ci of index.byLesson[li] ?? []) {
      const chunk = index.chunks[ci];

      /*
       * PHASE 1 — the AND gate, on existence only. `needles` is sorted longest-first,
       * which correlates with selectivity, so the chunk that is going to fail usually
       * fails on the first probe. Collecting ranges before knowing the chunk survives
       * was the expensive mistake in the first version of this loop.
       */
      let gated = false;
      for (let n = 0; n < needles.length; n++) {
        if (lessonHit[n] > 0) continue;
        if (!hasTerm(chunk.normText, needles[n]) && !hasTerm(chunk.normHeading, needles[n])) {
          gated = true;
          break;
        }
      }
      if (gated) continue;

      // PHASE 2 — this chunk is a result; now it is worth collecting offsets.
      const bodyRanges: Range[][] = [];
      let score = 0;
      let wholeWords = 0;
      let phrases = 0;
      let bodyHits = 0;
      let own = 0;

      for (let n = 0; n < needles.length; n++) {
        const needle = needles[n];
        const inHeading = findTerm(chunk.normHeading, needle);
        const inBody = findTerm(chunk.normText, needle);
        bodyRanges.push(inBody);

        const chunkHit = inHeading.length > 0
          ? FIELD_WEIGHT.heading
          : inBody.length > 0 ? FIELD_WEIGHT.body : 0;
        own += chunkHit;

        score += Math.max(lessonHit[n], chunkHit);

        if (inBody.length > 0) {
          bodyHits += inBody.length;
          if (inBody.some((r) => isWholeWord(chunk.normText, r))) wholeWords++;
          if (n >= phraseStart) phrases++;
        } else if (inHeading.length > 0) {
          if (inHeading.some((r) => isWholeWord(chunk.normHeading, r))) wholeWords++;
          if (n >= phraseStart) phrases++;
        }
      }

      score += phrases * PHRASE_BONUS;
      score += wholeWords * WHOLE_WORD_BONUS;
      score += Math.min(bodyHits, FREQUENCY_CAP) * FREQUENCY_WEIGHT;
      if (hasProximity(bodyRanges)) score += PROXIMITY_BONUS;

      anyGatePass = true;

      /*
       * A section with NOTHING of its own — it passed the gate purely on the lesson's
       * title or summary — must not become a row. It would render as a snippet with no
       * highlight in it, and the reader's fair question is "why is this here?". The
       * lesson still appears; see the head-chunk fallback below.
       */
      if (own === 0) continue;

      matches.push({
        chunk: ci,
        headingId: chunk.headingId,
        headingText: chunk.headingText,
        score,
        ranges: mergeRanges(bodyRanges.flat().map((r) => extendToWordEnd(chunk.normText, r))),
        headingRanges: mergeRanges(
          needles.flatMap((n) => findTerm(chunk.normHeading, n)).map((r) => extendToWordEnd(chunk.normHeading, r)),
        ),
      });
    }

    if (!anyGatePass) return;

    /*
     * A lesson matched ONLY by its title or summary has no section worth singling out,
     * so show it once at its head — whose snippet is the opening prose. Without this a
     * title match would either vanish or fill the list with identical rows.
     */
    const shown = matches.length > 0 ? matches : headFallback(index, li);
    if (shown.length === 0) return;

    shown.sort((a, b) => b.score - a.score || a.chunk - b.chunk);

    results.push({
      course: index.course,
      locale: index.locale,
      lesson,
      titleRanges: mergeRanges(
        needles.flatMap((n) => findTerm(lesson.normTitle, n)).map((r) => extendToWordEnd(lesson.normTitle, r)),
      ),
      score: shown[0].score,
      matches: shown.slice(0, MAX_SECTIONS_PER_LESSON),
      extraSections: Math.max(0, shown.length - MAX_SECTIONS_PER_LESSON),
    });
  });

  /*
   * Ties break on (block, order) — course order. Two equally-scoring lessons should read
   * in the sequence the syllabus teaches them, so a student searching "atención" meets
   * Bahdanau before Multi-Head. Both fields are locale-invariant (domain/types.ts).
   */
  results.sort(
    (a, b) =>
      b.score - a.score ||
      a.lesson.block - b.lesson.block ||
      a.lesson.order - b.lesson.order ||
      a.lesson.slug.localeCompare(b.lesson.slug),
  );

  return results.slice(0, opts.maxLessons ?? MAX_LESSONS);
}
