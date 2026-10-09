"use client";

/*
 * BLOG-13 — the blog index's list: area + topic filters, the featured newest post, the
 * card grid and the pager.
 *
 * The state lives in the URL (`/blog?area=bases-de-datos&topic=indices&page=2`, built
 * and parsed by `blog-filter.ts`), so a filtered view can be linked, reloaded and
 * walked with Back. Every post is already on the client — the page hands over the slim
 * `IndexEntry` list — so a filter or page change is a `history.pushState`, which the
 * Next router turns into a new `useSearchParams()` without a server round trip.
 *
 * Two components so the static HTML is the real page. `BlogIndex` reads
 * `useSearchParams()`, which in a prerendered route renders nothing on the server, so
 * the page wraps it in `<Suspense>` whose FALLBACK is `BlogIndexView` with no filter:
 * the prerendered HTML (what a crawler and a cold visitor get) is page 1 of the full
 * list, and the client swaps in the URL's view on hydration — identical for `/blog`.
 *
 * The filter being shown is also written to `blog-filter-store`, so the archive pane
 * beside a post opens on the same filter.
 *
 * Pagination entries are real links (`href="?page=2"`) so they open in a new tab and
 * crawl; a plain click is intercepted into a pushState. Filters are toggle buttons.
 * After a page change the list's head scrolls into view (instantly under
 * prefers-reduced-motion), since the pager sits at the bottom of the list it replaces.
 */

import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  BLOG_AREA_ICONS,
  BLOG_INDEX_PAGE_SIZE,
  BLOG_INDEX_TOPIC_LIMIT,
} from "@/constants/blog";
import type { BlogArea, BlogTopic } from "@/domain/types";
import {
  areaCounts,
  filterEntries,
  indexPage,
  indexSearch,
  isFiltered,
  normalizeFilter,
  pageNumbers,
  parseIndexParams,
  shownArea,
  topicCounts,
  type AreaFilter,
  type BlogFilter,
} from "./blog-filter";
import { setStoredBlogFilter } from "./blog-filter-store";
import type { IndexEntry } from "./archive-entries";

const RESULTS_ID = "blog-results";

interface RawIndexState {
  area:  string | null;
  topic: string | null;
  page:  number;
}

const UNFILTERED: RawIndexState = { area: null, topic: null, page: 1 };

/** The URL-driven list. Must sit inside a <Suspense> (see the header). */
export default function BlogIndex({ entries }: { entries: IndexEntry[] }) {
  const params = useSearchParams();
  return <BlogIndexView entries={entries} raw={parseIndexParams(params)} />;
}

/** The list for a given raw state: the Suspense fallback renders it unfiltered. */
export function BlogIndexFallback({ entries }: { entries: IndexEntry[] }) {
  return <BlogIndexView entries={entries} raw={UNFILTERED} />;
}

function BlogIndexView({ entries, raw }: { entries: IndexEntry[]; raw: RawIndexState }) {
  const t = useTranslations("blog");
  const pathname = usePathname();
  const [showAllTopics, setShowAllTopics] = useState(false);

  const filter = normalizeFilter(entries, raw);
  const filtered = isFiltered(filter);
  const list = filterEntries(entries, filter);
  const view = indexPage(list, filtered, raw.page, BLOG_INDEX_PAGE_SIZE);

  const areaLabel = (area: BlogArea) => t(`areas.${area}`);
  const topicLabel = (topic: BlogTopic) => t(`topics.${topic}`);

  // The pane beside a post opens on whatever the index is showing.
  useEffect(() => {
    setStoredBlogFilter({ area: filter.area, topic: filter.topic });
  }, [filter.area, filter.topic]);

  const hrefFor = (next: BlogFilter, page: number) => `${pathname}${indexSearch(next, page)}`;

  const go = (next: BlogFilter, page: number) => {
    window.history.pushState(null, "", hrefFor(next, page));
  };

  const pickArea = (area: AreaFilter) => {
    setShowAllTopics(false);
    go({ area, topic: null }, 1);
  };
  const pickTopic = (topic: BlogTopic) =>
    go({ area: filter.area, topic: filter.topic === topic ? null : topic }, 1);

  const onPageLink = (e: MouseEvent<HTMLAnchorElement>, page: number) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(filter, page);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(RESULTS_ID)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  // Topic chips: the area's topics, most-used first; past the limit behind a toggle,
  // except that the active one is always visible.
  const topics = topicCounts(entries, filter.area, topicLabel);
  const hiddenTopics = Math.max(0, topics.length - BLOG_INDEX_TOPIC_LIMIT);
  const visibleTopics = showAllTopics
    ? topics
    : topics.filter((x, i) => i < BLOG_INDEX_TOPIC_LIMIT || x.topic === filter.topic);

  const scope =
    (filter.area === "all"
      ? t("index.results.inAll")
      : t("index.results.inArea", { area: areaLabel(filter.area) })) +
    (filter.topic ? ` · #${topicLabel(filter.topic)}` : "");

  return (
    <>
      <section className="blog-filters" aria-label={t("filters.label")}>
        <div className="blog-filters__row">
          <span className="blog-filters__label" aria-hidden="true">{t("filters.area")}</span>
          <div className="blog-tabs" role="group" aria-label={t("filters.areas")}>
            <button
              type="button"
              className="blog-tab"
              aria-pressed={filter.area === "all"}
              onClick={() => pickArea("all")}
            >
              <span className="material-symbols-outlined blog-area-icon" aria-hidden="true">grid_view</span>
              {t("filters.all")}
              <span className="blog-tab__count">{entries.length}</span>
            </button>
            {areaCounts(entries).map(({ area, count }) => {
              const icon = BLOG_AREA_ICONS[area];
              return (
                <button
                  key={area}
                  type="button"
                  className="blog-tab"
                  aria-pressed={filter.area === area}
                  onClick={() => pickArea(area)}
                >
                  <span className="material-symbols-outlined blog-area-icon" data-area={area} aria-hidden="true">
                    {icon}
                  </span>
                  {areaLabel(area)}
                  <span className="blog-tab__count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {topics.length > 0 ? (
          <div className="blog-filters__row blog-filters__row--topics">
            <span className="blog-filters__label" aria-hidden="true">{t("filters.topic")}</span>
            <div className="blog-chips" role="group" aria-label={t("filters.topics")}>
              {visibleTopics.map(({ topic, count }) => (
                <button
                  key={topic}
                  type="button"
                  className="blog-chip"
                  aria-pressed={filter.topic === topic}
                  onClick={() => pickTopic(topic)}
                >
                  <span className="blog-chip__hash" aria-hidden="true">#</span>
                  {topicLabel(topic)}
                  <span className="blog-chip__count">{count}</span>
                </button>
              ))}
              {hiddenTopics > 0 ? (
                <button
                  type="button"
                  className="blog-chip blog-chip--more"
                  aria-expanded={showAllTopics}
                  onClick={() => setShowAllTopics((v) => !v)}
                >
                  {showAllTopics ? t("filters.fewerTopics") : t("filters.moreTopics", { count: hiddenTopics })}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <div className="blog-results" id={RESULTS_ID}>
        <p className="blog-results__summary" aria-live="polite">
          <strong>{t("index.results.count", { count: view.total })}</strong> {scope}
        </p>
        {filtered ? (
          <button type="button" className="blog-results__clear" onClick={() => pickArea("all")}>
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
            {t("filters.clear")}
          </button>
        ) : null}
        <span className="blog-results__page">
          {t("index.results.page", { page: view.page, pages: view.pageCount })}
        </span>
      </div>

      {view.featured ? <FeaturedCard entry={view.featured} area={shownArea(view.featured, filter)} /> : null}

      {view.items.length > 0 ? (
        <div className="blog-grid">
          {view.items.map((entry) => (
            <IndexCard key={entry.slug} entry={entry} area={shownArea(entry, filter)} />
          ))}
        </div>
      ) : null}

      {view.pageCount > 1 ? (
        <>
          <nav className="blog-pager" aria-label={t("index.pagination.label")}>
            <PagerStep
              page={view.page - 1}
              disabled={view.page <= 1}
              href={hrefFor(filter, view.page - 1)}
              onLink={onPageLink}
              direction="newer"
              label={t("index.pagination.newer")}
            />
            <div className="blog-pager__pages">
              {pageNumbers(view.page, view.pageCount).map((n, i) =>
                n === "gap" ? (
                  <span key={`gap-${i}`} className="blog-pager__gap" aria-hidden="true">…</span>
                ) : (
                  <a
                    key={n}
                    href={hrefFor(filter, n)}
                    className="blog-pager__num"
                    aria-current={n === view.page ? "page" : undefined}
                    aria-label={t("index.pagination.page", { page: n })}
                    onClick={(e) => onPageLink(e, n)}
                  >
                    {n}
                  </a>
                ),
              )}
            </div>
            <PagerStep
              page={view.page + 1}
              disabled={view.page >= view.pageCount}
              href={hrefFor(filter, view.page + 1)}
              onLink={onPageLink}
              direction="older"
              label={t("index.pagination.older")}
            />
          </nav>
          <p className="blog-pager__range">
            {view.first === view.last
              ? t("index.results.rangeOne", { first: view.first, total: view.total })
              : t("index.results.range", { first: view.first, last: view.last, total: view.total })}
          </p>
        </>
      ) : null}
    </>
  );
}

function PagerStep({
  page,
  disabled,
  href,
  onLink,
  direction,
  label,
}: {
  page: number;
  disabled: boolean;
  href: string;
  onLink: (e: MouseEvent<HTMLAnchorElement>, page: number) => void;
  direction: "newer" | "older";
  label: string;
}) {
  const arrow = (
    <span className="material-symbols-outlined" aria-hidden="true">
      {direction === "newer" ? "arrow_back" : "arrow_forward"}
    </span>
  );
  const content =
    direction === "newer" ? (
      <>
        {arrow}
        <span className="blog-pager__step-label">{label}</span>
      </>
    ) : (
      <>
        <span className="blog-pager__step-label">{label}</span>
        {arrow}
      </>
    );

  // A disabled step is not a link at all: nothing to follow, nothing to Tab to.
  if (disabled) {
    return (
      <span className="blog-pager__step" aria-disabled="true">
        {content}
      </span>
    );
  }
  return (
    <a href={href} className="blog-pager__step" aria-label={label} onClick={(e) => onLink(e, page)}>
      {content}
    </a>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

/** `post.date` is a calendar day; pinned to UTC so no zone shows the day before. */
function useDay() {
  const format = useFormatter();
  return (date: string, month: "long" | "short") =>
    format.dateTime(new Date(`${date}T00:00:00Z`), { day: "numeric", month, year: "numeric", timeZone: "UTC" });
}

/** A figure of the post, or its area's glyph when it has no cover. Decorative: the
 *  card's title says what the post is. */
function CardMedia({ entry, area, eager = false }: { entry: IndexEntry; area: BlogArea; eager?: boolean }) {
  const icon = BLOG_AREA_ICONS[area];
  return (
    <div className="blog-media" data-area={area}>
      {entry.cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- static SVG figure from public/, sized by its box
        <img src={entry.cover} alt="" loading={eager ? "eager" : "lazy"} decoding="async" />
      ) : (
        <span className="material-symbols-outlined blog-media__icon" aria-hidden="true">
          {icon}
        </span>
      )}
    </div>
  );
}

function AreaBadge({ area }: { area: BlogArea }) {
  const t = useTranslations("blog.areas");
  return (
    <span className="blog-area-badge" data-area={area}>
      {t(area)}
    </span>
  );
}

/** `area`: the one to label the card with (`shownArea`). */
function FeaturedCard({ entry, area }: { entry: IndexEntry; area: BlogArea }) {
  const t = useTranslations("blog");
  const day = useDay();
  return (
    <Link href={`/blog/${entry.slug}`} className="blog-featured">
      <CardMedia entry={entry} area={area} eager />
      <div className="blog-featured__body">
        <div className="blog-featured__eyebrow">
          <span className="blog-featured__new">{t("index.featured")}</span>
          <AreaBadge area={area} />
        </div>
        <h2 className="blog-featured__title lp-serif">{entry.title}</h2>
        <p className="blog-featured__summary">{entry.summary}</p>
        <p className="blog-meta">
          <time dateTime={entry.date}>{day(entry.date, "long")}</time>
          <span className="blog-meta__dot" aria-hidden="true" />
          <span>{t("card.readingTime", { minutes: entry.minutes })}</span>
        </p>
        <div className="blog-featured__foot">
          <Tags tags={entry.tags} />
          <span className="blog-cta">
            {t("card.cta")}
            <span className="material-symbols-outlined blog-cta__arrow" aria-hidden="true">arrow_forward</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function IndexCard({ entry, area }: { entry: IndexEntry; area: BlogArea }) {
  const t = useTranslations("blog.card");
  const day = useDay();
  return (
    <Link href={`/blog/${entry.slug}`} className="blog-card">
      <CardMedia entry={entry} area={area} />
      <div className="blog-card__body">
        <div className="blog-card__top">
          <AreaBadge area={area} />
          <p className="blog-meta">
            <time dateTime={entry.date}>{day(entry.date, "short")}</time>
            <span className="blog-meta__dot" aria-hidden="true" />
            <span>{t("minutes", { minutes: entry.minutes })}</span>
          </p>
        </div>
        <h2 className="blog-card__title lp-serif">{entry.title}</h2>
        <p className="blog-card__summary">{entry.summary}</p>
        <div className="blog-card__foot">
          <Tags tags={entry.tags} />
          {/* The icon font on its own element: `.blog-cta` sets Manrope, which would win
              over `.material-symbols-outlined` on the same span and print the ligature. */}
          <span className="blog-cta" aria-hidden="true">
            <span className="material-symbols-outlined blog-cta__arrow">arrow_forward</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function Tags({ tags }: { tags: readonly BlogTopic[] }) {
  const t = useTranslations("blog.topics");
  if (tags.length === 0) return <span />;
  return (
    <ul className="blog-tags">
      {tags.map((tag) => (
        <li key={tag} className="blog-tag">#{t(tag)}</li>
      ))}
    </ul>
  );
}
