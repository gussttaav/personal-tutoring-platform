"use client";

/*
 * COURSE-P9-02 — Inline search in the desktop sidebar.
 *
 * A real field under the back-to-course link. While the trimmed query is non-empty the block
 * list (`children`, server-rendered by LessonSidebar) is HIDDEN and the results take its place
 * in the rail; the × (or Escape) brings the list back. Results are meant to coexist with the
 * reading: clicking one navigates, the page tree remounts, and the field re-reads its query from
 * the module-level store (sidebar-query-store.ts) so the same results are in the first frame of
 * the next lesson. The index comes back `ready` from useSearchIndex's resolved cache for the same
 * reason.
 *
 * Deliberately NOT the dialog's combobox model. Results here replace a list of ordinary links,
 * so they are ordinary links: tabbable, `aria-current` on the lesson being read, next-intl
 * `<Link>` adding the locale prefix itself (the dialog's raw `<a>` + `getPathname` exists only
 * because `role="option"` may not contain a `<Link>`). Enter in the field opens the first result
 * (the dialog's default active option), Escape clears.
 *
 * `children` is hidden, not unmounted: `<details>` toggles the reader made survive search →
 * clear, the progress leaves keep their context subscriptions, and the stable element lets React
 * skip that subtree on every keystroke. `hidden` goes on the wrapper div — the inner `<ol>`
 * carries an inline `display:flex` that would beat the UA `[hidden]` rule.
 *
 * Mounted only by the desktop variant of LessonSidebar, so there is exactly one field in the DOM
 * even though the sidebar is rendered twice. Below 768px the desktop aside is `display:none`, so
 * this also sits, inert, on mobile: nothing focuses it, nothing fetches, and the mobile bar's
 * icon button keeps opening the dialog.
 */

import { useDeferredValue, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { search, type PreparedIndex } from "@/lib/courses/search/rank";
import { buildSnippet } from "@/lib/courses/search/snippet";
import { MIN_QUERY_LENGTH } from "@/lib/courses/search/query";
import { contentLanguage, isFallbackLesson } from "@/lib/courses/search/content-language";
import { useCourseSearch } from "./CourseSearchProvider";
import { useSearchIndex } from "./useSearchIndex";
import { readSidebarQuery, sidebarQueryKey, writeSidebarQuery } from "./sidebar-query-store";
import HighlightedText from "./HighlightedText";

/** The rail is 280px; the dialog's 180-char default is two lines at 680px, five here. */
const SIDEBAR_SNIPPET_LENGTH = 90;

/** Stable placeholder while the index loads — a literal would churn identity each render. */
const EMPTY_INDEX: PreparedIndex = {
  course: "",
  locale: "",
  lessons: [],
  chunks: [],
  byLesson: [],
};

interface SidebarSearchProps {
  /** Marks the lesson being read with `aria-current` inside the results. */
  currentSlug: string;
  /** Progress bar + block list; hidden, never unmounted, while results show. */
  children:    ReactNode;
}

export default function SidebarSearch({ currentSlug, children }: SidebarSearchProps) {
  const t = useTranslations("courses.search");
  const tReader = useTranslations("courses.reader");
  const tLanding = useTranslations("courses.landing");
  const router = useRouter();
  const { courseSlug, version, locale, lessonCount } = useCourseSearch();

  const storeKey = sidebarQueryKey(courseSlug, locale);
  // Lazy initializer, not an effect: on client-side navigation there is no hydration, so the
  // persisted query is in the very first render; on a hard load the store is empty on both sides.
  const [query, setQuery] = useState(() => readSidebarQuery(storeKey));
  const deferredQuery = useDeferredValue(query);

  // The index is fetched on first focus or as soon as there is a query — whichever comes
  // first — never on page load, since most readers never search. Both signals, because a
  // value can arrive without a focus event (a persisted query on remount, a browser
  // restoring the field on back/forward) and a query with no index would spin forever.
  const [focused, setFocused] = useState(false);
  const enabled = focused || query.trim().length > 0;
  const { state, retry } = useSearchIndex(courseSlug, version, locale, enabled);

  const inputRef = useRef<HTMLInputElement>(null);

  /** The only writer: change, clear, Escape. */
  const update = (next: string) => {
    setQuery(next);
    writeSidebarQuery(storeKey, next);
  };

  const clear = () => {
    update("");
    inputRef.current?.focus();
  };

  const index: PreparedIndex = useMemo(
    () => (state.status === "ready" ? state.index : EMPTY_INDEX),
    [state],
  );

  const results = useMemo(
    () => (index.lessons.length > 0 ? search(index, deferredQuery) : []),
    [index, deferredQuery],
  );

  /** Untranslated / partly / fully — decides between one notice and per-result tags. */
  const language = useMemo(() => contentLanguage(index), [index]);

  const lessonHref = (course: string, slug: string) => `/cursos/${course}/${slug}`;
  const sectionHref = (course: string, slug: string, headingId: string) =>
    lessonHref(course, slug) + (headingId ? `#${headingId}` : "");

  const trimmed = query.trim();
  const active = trimmed.length > 0;
  const tooShort = active && trimmed.length < MIN_QUERY_LENGTH;
  const showResults = state.status === "ready" && results.length > 0;
  const showEmpty = state.status === "ready" && results.length === 0 && trimmed.length >= MIN_QUERY_LENGTH;

  /** Enter opens the top section row — the dialog's default active option. */
  const openFirst = () => {
    const first = results[0];
    if (!showResults || !first) return;
    router.push(sectionHref(first.course, first.lesson.slug, first.matches[0]?.headingId ?? ""));
  };

  // Enter is handled on keydown, like the dialog, rather than left to the form's implicit
  // submission — preventing the default here also suppresses that, so it cannot run twice.
  // `onSubmit` stays as the same action for any other route into a submit (a virtual
  // keyboard's "Go", a browser that submits on the keypress this handler never saw).
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    openFirst();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      openFirst();
      return;
    }
    // Handled here rather than left to type=search's native clear: Chromium fires `input`
    // with "" on Escape, Firefox does not, and neither keeps our store in sync.
    if (e.key === "Escape" && query) {
      e.preventDefault();
      clear();
    }
  };

  return (
    <div className="cs-sidebar">
      <form role="search" className="cs-field" onSubmit={onSubmit}>
        <span className="material-symbols-outlined" aria-hidden="true">search</span>
        <input
          ref={inputRef}
          className="cs-input"
          type="search"
          autoComplete="off"
          spellCheck={false}
          aria-label={t("dialogTitle")}
          placeholder={t("placeholder", { count: lessonCount })}
          value={query}
          onChange={(e) => update(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <button type="button" className="cs-iconbtn" onClick={clear} aria-label={t("clear")}>
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        ) : null}
      </form>

      {active ? (
        <div className="cs-sidebar-results">
          {/* COURSE-P6-03b: say plainly that the prose is not in the requested language —
              only while NO lesson is translated; a partly translated course tags the
              Spanish results instead (content-language.ts). */}
          {language === "fallback" ? (
            <p className="cs-notice">
              <span className="material-symbols-outlined" aria-hidden="true">translate</span>
              <span>{tLanding("languageNotice.title")}</span>
            </p>
          ) : null}

          <p className="cs-sidebar-count" role="status" aria-live="polite">
            {trimmed.length >= MIN_QUERY_LENGTH && state.status === "ready"
              ? t("resultCount", { count: results.length })
              : ""}
          </p>

          {state.status === "loading" ? (
            <p className="cs-state"><span className="cs-state-body">{t("loading")}</span></p>
          ) : null}

          {state.status === "error" ? (
            <div className="cs-state cs-state--error" role="alert">
              <p className="cs-state-title">{t("errorTitle")}</p>
              <p className="cs-state-body">{t("errorBody")}</p>
              <button type="button" className="cs-retry" onClick={retry}>{t("errorRetry")}</button>
            </div>
          ) : null}

          {tooShort ? <p className="cs-state"><span className="cs-state-body">{t("minChars")}</span></p> : null}

          {showEmpty ? (
            <div className="cs-state">
              <p className="cs-state-title">{t("emptyTitle", { query: trimmed })}</p>
              <p className="cs-state-body">{t("emptyBody")}</p>
            </div>
          ) : null}

          {showResults ? (
            <ol className="cs-sidebar-list" aria-label={t("resultsLabel")}>
              {results.map((result) => {
                const isCurrent = result.lesson.slug === currentSlug;
                return (
                  <li className="cs-group" key={result.lesson.slug}>
                    <Link
                      className="cs-grouphead cs-grouplink"
                      href={lessonHref(result.course, result.lesson.slug)}
                      aria-current={isCurrent ? "page" : undefined}
                    >
                      <span className="cs-kicker">
                        {tReader("refKicker", { block: result.lesson.block, order: result.lesson.order })}
                        {language === "partial" && isFallbackLesson(result.lesson, index.locale)
                          ? ` · ${tReader("refFallback")}`
                          : ""}
                      </span>
                      <span className="cs-title">
                        <HighlightedText text={result.lesson.title} ranges={result.titleRanges} />
                      </span>
                    </Link>

                    <ol className="cs-sidebar-sections">
                      {result.matches.map((match) => {
                        const chunkText = index.chunks[match.chunk]?.text ?? "";
                        const snippet = buildSnippet(chunkText, match.ranges, SIDEBAR_SNIPPET_LENGTH);
                        return (
                          <li key={match.chunk}>
                            <Link
                              className="cs-option"
                              href={sectionHref(result.course, result.lesson.slug, match.headingId)}
                            >
                              <span className="cs-option-body">
                                <span className="cs-breadcrumb">
                                  <span className="material-symbols-outlined" aria-hidden="true">subdirectory_arrow_right</span>
                                  {/* One flex item for the whole heading: HighlightedText is a
                                      fragment of text runs and <mark>s, and unwrapped each would
                                      become its own column. */}
                                  <span className="cs-breadcrumb-text">
                                    {match.headingText ? (
                                      <HighlightedText text={match.headingText} ranges={match.headingRanges} />
                                    ) : (
                                      t("introSection")
                                    )}
                                  </span>
                                </span>
                                <span className="cs-snippet">
                                  {snippet.leadingEllipsis ? "… " : null}
                                  <HighlightedText text={snippet.text} ranges={snippet.marks} />
                                  {snippet.trailingEllipsis ? " …" : null}
                                </span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ol>

                    {result.extraSections > 0 ? (
                      <span className="cs-more">{t("moreSections", { count: result.extraSections })}</span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : null}
        </div>
      ) : null}

      {/* Always mounted — see the header for why `hidden` lives here and not on the <ol>. */}
      <div hidden={active}>{children}</div>
    </div>
  );
}
