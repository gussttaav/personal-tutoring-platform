# P1-03 — Courses + latest posts

**Tag:** `REDESIGN-P1-03` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P1-02

## TL;DR

Add the two editorial bands to `/`: the course cards from the catalog registry and the two
latest posts from the blog registry, each under the inner-page section head (kicker + hairline
rule, serif title with the italic accent, «Ver todos…» link on the right). The cards are the
existing `CourseCard` and `PostCard`, unchanged; only the grids around them are new.

## Context

- `design/home.html` — `.lp-head` / `.lp-kicker` / `.lp-rule` (from
  `src/features/courses/course-editorial.css`), `.lp-title-row` (column below 768, row with the
  link bottom-aligned above), `.lp-h2` (Newsreader 500, `clamp(1.75rem, 3.6vw, 2.5rem)`),
  `.see-all`, `.courses-grid` (one column, two from 768), `.posts-grid` (one column, two from
  768, `22px` gap).
- `src/app/[locale]/cursos/page.tsx:56-61` — how the catalog page builds the card props from
  `listCatalogEntries(locale)` (`lessonCount`, `blockCount` from the published lessons) — copy
  this, do not re-derive. `:17-18` — it imports `course-editorial.css` and `catalog.css`.
- `src/features/courses/catalog/CourseCard.tsx` — async server component, props `course`,
  `lessonCount`, `blockCount`, `locale`, `contentLocale?`; renders `CourseCardActions` (a client
  island that shows «Continuar» for readers with progress) and the whole-card cover link.
- `src/features/courses/catalog/catalog.css:16-20` — `.courses-grid` is `auto-fill,
  minmax(320px, 1fr)`: at 1200px that is three columns and an orphan. The home needs its own
  two-column grid; the card styles (`.course-card…`) are reused as-is.
- `src/app/[locale]/blog/page.tsx:58-62` — `listPosts(locale)`; `:19-20` imports
  `course-editorial.css` + `blog.css`. `src/features/blog/PostCard.tsx` — async server component,
  props `post`, `locale`; the whole card is one `<Link>`.
- `src/app/[locale]/blog/blog.css:20-24` — `.blog-list` is a single column; the card styles
  (`.post-card…`) are reused as-is.
- `messages/*.json` — `courses.catalog.{overline, heading}` («Aprende construyendo, <accent>no
  memorizando</accent>»), `blog.index.overline`; the home's blog heading is NEW («En clase parece
  simple, <accent>aquí profundizo</accent>» — chosen on the canvas), plus the two «Ver todos»
  labels.

## Files affected

| File | Change |
|------|--------|
| `src/features/home/HomeCourses.tsx` | **New**, async server. Section head (`courses.catalog.overline`, `courses.catalog.heading` via `t.rich` with the same `accent` renderer `cursos/page.tsx` uses), `<Link href="/cursos">` with `home.courses.seeAll`; the cards from `listCatalogEntries(locale)` exactly as the catalog builds them; renders nothing when the list is empty |
| `src/features/home/HomePosts.tsx` | **New**, async server. Section head (`blog.index.overline`, `home.blog.heading` via `t.rich`), `<Link href="/blog">` with `home.blog.seeAll`; `listPosts(locale).slice(0, 2)` → `PostCard`; renders nothing when empty |
| `src/features/home/home.css` | `+ .home-section-title-row`, `.home-see-all`, `.home-courses-grid`, `.home-posts-grid` (the design's values) |
| `src/app/[locale]/page.tsx` | `+ import "@/features/courses/course-editorial.css"`, `"@/features/courses/catalog/catalog.css"`, `"@/app/[locale]/blog/blog.css"` (or move `blog.css` next to `PostCard` if importing across routes reads wrong — see Gotchas); mount `HomeCourses` then `HomePosts` after the bio band |
| `messages/es.json`, `messages/en.json` | `home.courses.seeAll` («Ver todos los cursos» / «See all courses»), `home.blog.heading` («En clase parece simple, <accent>aquí profundizo</accent>» / an English line of the same shape, e.g. «It looks simple in class, <accent>here I go deeper</accent>»), `home.blog.seeAll` («Ver todos los artículos» / «See all articles») — key-for-key |

## The change

**Reuse the cards, own the grids.** `CourseCard` and `PostCard` already carry the surface, the
hover bloom, the serif title with the green tail and the arrow. What the home needs is a
two-column arrangement of both, with the section head pattern the catalog and the blog use. So
the two components import nothing new; the home adds two grid classes and mounts the cards.

**Same data path as the pages.** The course counts come from the same selector the catalog page
uses, so the home can never disagree with `/cursos` (the `COURSE-P6-03` rule: one selector,
one truth). The posts are the first two of the published-only list the blog index renders.

**Empty locales.** The English catalog and blog both have content today, but the selectors are
published-only and a locale can be empty in the future: each band returns `null` when its list
is empty rather than rendering a head over nothing.

**CSS ownership.** `blog.css` lives under the blog route. Importing it from the home is
allowed by Next (global CSS from a page), but if it reads wrong, move the file to
`src/features/blog/blog.css` and update the blog page's import in the same PR — the cards'
styles belong with the card, as `catalog.css` already does. Say which in STATUS.

## Acceptance criteria

- [ ] `/` shows the two bands as `design/home.html`: at 1440 two course cards side by side,
      two post cards side by side; at 834 the same; at 390 stacked
- [ ] The course cards show the same counts as `/cursos`; the «Continuar» island appears for a
      reader with progress (sign in on staging, open a lesson, come back)
- [ ] Hover on either card matches the catalog/blog hover (lift, bloom, arrow nudge)
- [ ] The post cards are the two newest published posts, same order as `/blog`
- [ ] `/en` shows the English catalog entries and posts; a `contentLocale` badge appears on a
      card whose lessons are Spanish, as on `/en/cursos`
- [ ] «Ver todos los cursos» → `/cursos`, «Ver todos los artículos» → `/blog`, locale-aware
- [ ] Both message files carry the three new keys
- [ ] `pnpm lint`, `pnpm test`, `pnpm lint:content`, `pnpm build` green

## Test plan

```bash
pnpm lint
pnpm lint:content
pnpm test
pnpm build
```

Browser pane at the three widths, both locales.

## Gotchas

- `CourseCard` and `PostCard` are `async` server components — the home page is a server
  component, so they can be awaited in JSX directly, as the catalog/blog pages do.
- `t.rich` with `<accent>` needs the same renderer as `cursos/page.tsx:94-98`; keep the italic
  green span inline.
- Do not add a third course card «placeholder» or a «notify me» card on the home; the notify
  cards belong to `/cursos` and `/blog`.
- `course-editorial.css` is already imported by the course and blog routes; importing it from
  `/` as well is fine (global CSS is deduplicated by Next).

## Out of scope

- Any change to `CourseCard`, `PostCard`, `catalog.css` card rules or `blog.css` card rules.
- Renaming the blog index heading on `/blog` to the new line — the user may want it, ask in
  STATUS; the design changed the home's only.
