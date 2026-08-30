"use client";

/*
 * COURSE-P9-01 — The search overlay.
 *
 * A11y model is the ARIA combobox/listbox pattern: focus never leaves the input, arrow
 * keys move `aria-activedescendant`, Enter opens the active option. Options are still real
 * anchors so ⌘-click, middle-click and "copy link address" work; `tabIndex={-1}` keeps
 * them out of the focus trap's FOCUSABLE selector, which is what makes the two models
 * coexist.
 *
 * Focus trap, Escape, scroll lock and focus restore are the pattern from
 * reader/MobileLessonBar.tsx (lines 23-83), reused rather than reinvented — with one
 * change: the body lock goes through the ref-counted `lockBodyScroll` in hooks/scroll-lock.ts,
 * because this dialog can be opened while the mobile drawer is already holding the lock and
 * a naive restore would unlock the page behind the still-open drawer.
 *
 * Searching is synchronous and local (~0.6 ms), so there is no debounce and no request per
 * keystroke. `useDeferredValue` is here for RENDERING the list, not for the search itself.
 */

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { getPathname, useRouter } from "@/i18n/navigation";
import { lockBodyScroll } from "@/hooks/scroll-lock";
import { search, type PreparedIndex, type SearchMatch, type SearchResult } from "@/lib/courses/search/rank";
import { buildSnippet } from "@/lib/courses/search/snippet";
import { MIN_QUERY_LENGTH } from "@/lib/courses/search/query";
import { useCourseSearch } from "./CourseSearchProvider";
import { useSearchIndex } from "./useSearchIndex";
import { isNavigationKey, nextActiveIndex } from "./keyboard";
import HighlightedText from "./HighlightedText";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Query suggestions for the idle state. Content-agnostic: taken from lesson titles. */
const TIP_COUNT = 3;

/** Stable placeholder while the index loads — a literal would churn identity each render. */
const EMPTY_INDEX: PreparedIndex = {
  course: "",
  locale: "",
  lessons: [],
  chunks: [],
  byLesson: [],
};

interface Row {
  result: SearchResult;
  match:  SearchMatch;
  href:   string;
  text:   string;
}

/*
 * Options are raw <a> elements, not next-intl <Link>s, so that ⌘-click and middle-click
 * open a real new tab — a <Link> inside a `role="option"` would nest interactive content
 * and break the combobox model. The cost is that nothing adds the locale prefix for us,
 * so `getPathname` does it explicitly. Skipping this silently drops the `/en` prefix from
 * every copied or middle-clicked result while keyboard navigation still works, which is
 * exactly the kind of bug that ships.
 */

export default function CourseSearchDialog() {
  const t = useTranslations("courses.search");
  // Reuses the reader's existing "Bloque {block} · Lección {order}" string rather than
  // adding a fourth translation of the same sentence.
  const tReader = useTranslations("courses.reader");
  // "Las lecciones están en español" / "The lessons are in Spanish" — already written and
  // translated for the landing page's ContentLanguageNotice; not worth a fourth variant.
  const tLanding = useTranslations("courses.landing");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { closeSearch, courseSlug, version, locale, lessonCount } = useCourseSearch();
  const { state, retry } = useSearchIndex(courseSlug, version, locale);

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  /*
   * The active option resets whenever the query changes. Derived during render rather
   * than reset from an effect: `react-hooks/set-state-in-effect` rejects the effect
   * version, and this is the state the effect was only ever approximating anyway.
   */
  const [selection, setSelection] = useState({ query: "", index: 0 });
  const active = selection.query === deferredQuery ? selection.index : 0;
  const setActive = useCallback(
    (next: number | ((current: number) => number)) =>
      setSelection((prev) => {
        const current = prev.query === deferredQuery ? prev.index : 0;
        return { query: deferredQuery, index: typeof next === "function" ? next(current) : next };
      }),
    [deferredQuery],
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Set on every keydown so hover cannot steal the selection during arrow scrolling. */
  const keyboardNav = useRef(false);

  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const titleId = `${baseId}-title`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const index: PreparedIndex = useMemo(
    () => (state.status === "ready" ? state.index : EMPTY_INDEX),
    [state],
  );

  const results = useMemo(
    () => (index.lessons.length > 0 ? search(index, deferredQuery) : []),
    [index, deferredQuery],
  );

  /** Flat option list: one row per matching section, so arrows traverse sections. */
  const hrefFor = useCallback(
    (result: SearchResult, match: SearchMatch) =>
      getPathname({ href: `/cursos/${result.course}/${result.lesson.slug}`, locale }) +
      (match.headingId ? `#${match.headingId}` : ""),
    [locale],
  );

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const result of results) {
      for (const match of result.matches) {
        out.push({
          result,
          match,
          text: index.chunks[match.chunk]?.text ?? "",
          href: hrefFor(result, match),
        });
      }
    }
    return out;
  }, [results, index, hrefFor]);

  /** Any lesson whose prose is not in the requested locale (COURSE-P6-03b fallback). */
  const contentMismatch = useMemo(
    () => index.lessons.some((l) => l.contentLocale !== index.locale),
    [index],
  );

  const tips = useMemo(() => {
    const titles = index.lessons.map((l) => l.title);
    // Spread across the course rather than the first three, which are all Block 1.
    const step = Math.max(1, Math.floor(titles.length / (TIP_COUNT + 1)));
    return titles.filter((_, i) => i > 0 && i % step === 0).slice(0, TIP_COUNT);
  }, [index]);

  const go = useCallback(
    (href: string) => {
      closeSearch();
      router.push(href);
    },
    [closeSearch, router],
  );

  // Scroll lock + Escape + focus trap while open; focus restore is handled by the browser
  // returning to the trigger, which React keeps mounted underneath.
  useEffect(() => {
    const releaseScroll = lockBodyScroll();
    const previouslyFocused = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSearch();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;

      if (e.shiftKey && (current === first || current === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      releaseScroll();
      previouslyFocused?.focus();
    };
  }, [closeSearch]);

  // Keep the active option in view during arrow navigation.
  useEffect(() => {
    if (!keyboardNav.current) return;
    listRef.current
      ?.querySelector<HTMLElement>(`#${CSS.escape(`${baseId}-opt-${active}`)}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, baseId]);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isNavigationKey(e.key)) {
      e.preventDefault();
      keyboardNav.current = true;
      setActive((i) => nextActiveIndex(i, rows.length, e.key as never));
      return;
    }
    if (e.key === "Enter" && rows[active]) {
      e.preventDefault();
      go(rows[active].href);
    }
  };

  const tooShort = query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH;
  const showResults = state.status === "ready" && rows.length > 0;
  const showEmpty =
    state.status === "ready" && rows.length === 0 && query.trim().length >= MIN_QUERY_LENGTH;

  let rowCursor = -1;

  return createPortal(
    <>
      <div className="cs-backdrop" onClick={closeSearch} />
      <div
        ref={panelRef}
        className="cs-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="sr-only">{t("dialogTitle")}</h2>

        <div className="cs-header">
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
          <input
            ref={inputRef}
            className="cs-input"
            type="search"
            role="combobox"
            aria-expanded={showResults}
            aria-controls={listId}
            aria-activedescendant={showResults && rows[active] ? optionId(active) : undefined}
            aria-autocomplete="list"
            aria-label={t("dialogTitle")}
            autoComplete="off"
            spellCheck={false}
            placeholder={t("placeholder", { count: lessonCount })}
            value={query}
            onChange={(e) => { keyboardNav.current = false; setQuery(e.target.value); }}
            onKeyDown={onInputKeyDown}
          />
          {query ? (
            <button type="button" className="cs-iconbtn" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label={t("clear")}>
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          ) : null}
          <button type="button" className="cs-iconbtn cs-close" onClick={closeSearch} aria-label={t("close")}>
            <span className="material-symbols-outlined" aria-hidden="true">keyboard_return</span>
          </button>
          {/* Mobile only (the icon button is hidden there). "Cancelar" reads better than
              "Cerrar la búsqueda" as a text button, and the string already exists. */}
          <button type="button" className="cs-cancel" onClick={closeSearch}>{tCommon("cancel")}</button>
        </div>

        {/* COURSE-P6-03b: say plainly that the prose is not in the requested language.
            Searching /en finds Spanish text today, and hiding that would be a lie the
            first result immediately exposes. Disappears on its own once en/ lessons land. */}
        {contentMismatch ? (
          <p className="cs-notice">
            <span className="material-symbols-outlined" aria-hidden="true">translate</span>
            <span>{tLanding("languageNotice.title")}</span>
          </p>
        ) : null}

        <div className="cs-results" ref={listRef}>
          <div role="listbox" id={listId} aria-label={t("resultsLabel")} aria-busy={state.status === "loading"}>
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

            {state.status === "ready" && query.trim().length === 0 ? (
              <div className="cs-state">
                <p className="cs-state-title">{t("tipsHeading")}</p>
                <div className="cs-tips">
                  {tips.map((tip) => (
                    <button key={tip} type="button" className="cs-chip" onClick={() => setQuery(tip)}>{tip}</button>
                  ))}
                </div>
                <p className="cs-state-body" style={{ marginTop: 16 }}>{t("scopeNote")}</p>
              </div>
            ) : null}

            {tooShort ? <p className="cs-state"><span className="cs-state-body">{t("minChars")}</span></p> : null}

            {showEmpty ? (
              <div className="cs-state">
                <p className="cs-state-title">{t("emptyTitle", { query: query.trim() })}</p>
                <p className="cs-state-body">{t("emptyBody")}</p>
              </div>
            ) : null}

            {showResults
              ? results.map((result) => {
                  return (
                    <div className="cs-group" role="group" key={result.lesson.slug}>
                      <div className="cs-grouphead" role="presentation">
                        <span className="cs-kicker">
                          {tReader("refKicker", { block: result.lesson.block, order: result.lesson.order })}
                        </span>
                        <span className="cs-title">
                          <HighlightedText text={result.lesson.title} ranges={result.titleRanges} />
                        </span>
                      </div>

                      {result.matches.map((match) => {
                        rowCursor += 1;
                        const i = rowCursor;
                        const chunkText = index.chunks[match.chunk]?.text ?? "";
                        const snippet = buildSnippet(chunkText, match.ranges);
                        return (
                          <a
                            key={`${match.chunk}`}
                            id={optionId(i)}
                            role="option"
                            aria-selected={i === active}
                            tabIndex={-1}
                            className="cs-option"
                            href={hrefFor(result, match)}
                            onClick={(e) => {
                              // Let the browser handle modified clicks (new tab, etc.).
                              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                              e.preventDefault();
                              go(rows[i].href);
                            }}
                            onMouseMove={() => { if (!keyboardNav.current) setActive(i); }}
                          >
                            <span className="cs-option-body">
                              <span className="cs-breadcrumb">
                                <span className="material-symbols-outlined" aria-hidden="true">subdirectory_arrow_right</span>
                                {match.headingText ? (
                                  <HighlightedText text={match.headingText} ranges={match.headingRanges} />
                                ) : (
                                  t("introSection")
                                )}
                              </span>
                              <span className="cs-snippet">
                                {snippet.leadingEllipsis ? "… " : null}
                                <HighlightedText text={snippet.text} ranges={snippet.marks} />
                                {snippet.trailingEllipsis ? " …" : null}
                              </span>
                            </span>
                            <span className="material-symbols-outlined cs-enter" aria-hidden="true">keyboard_return</span>
                          </a>
                        );
                      })}

                      {result.extraSections > 0 ? (
                        <span className="cs-more">{t("moreSections", { count: result.extraSections })}</span>
                      ) : null}
                    </div>
                  );
                })
              : null}
          </div>
        </div>

        <div className="cs-footer">
          <span className="cs-hint"><kbd className="cs-kbd">↑</kbd><kbd className="cs-kbd">↓</kbd> {t("hintNavigate")}</span>
          <span className="cs-hint"><kbd className="cs-kbd">↵</kbd> {t("hintOpen")}</span>
          <span className="cs-hint"><kbd className="cs-kbd">esc</kbd> {t("hintClose")}</span>
          <span className="cs-count" role="status" aria-live="polite">
            {query.trim().length >= MIN_QUERY_LENGTH && state.status === "ready"
              ? t("resultCount", { count: results.length })
              : ""}
          </span>
        </div>
      </div>
    </>,
    document.body,
  );
}
