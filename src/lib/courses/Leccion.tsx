/*
 * COURSE-P7-01 — `<Leccion slug="…">`, the cross-lesson reference.
 *
 * Before this component a reference was prose: "la lección 5 de este bloque, sobre
 * descenso de gradiente". That sentence hand-copies two fields the registry already
 * owns — the target's POSITION and its TITLE — so reordering a lesson makes every
 * sentence citing it lie, and nothing in `lint:content` can see it. The author now
 * writes a slug and the build decides the rest.
 *
 * Whether a reference LINKS is not authored either. It follows from position:
 *
 *   - behind the reader                → link + hover card
 *   - ahead, above the bridge `---`    → link + card marked «Más adelante»
 *   - ahead, below the bridge `---`    → plain text; `LessonNav` links that exact
 *                                        lesson two paragraphs down, and a second
 *                                        link to it in the hand-off is noise
 *   - `draft: true`                    → plain text; the route is not generated
 *
 * Reordering a lesson in the manifest reclassifies its references by itself.
 *
 * The hover card is SERVER-rendered — three registry fields in a `<span>` that CSS
 * shows on hover. No client component, no `use client`, nothing added to the lesson
 * bundle: the P1-04 bundle guard exists to keep the reading column free of JS, and a
 * tooltip is not a reason to spend it.
 *
 * COURSE-P11-01 — a reference now resolves PER REFERENCE, not once per page. On a
 * translated lesson under `/en`, most targets are still Spanish-only; looking every slug
 * up in the English tree alone returns `null` and degrades all of them to plain text —
 * the exact failure `contentLocale` was introduced to prevent, one level up. Resolution
 * is therefore the same two-step `listLessonViews` uses: the reference's own content
 * locale, then the canonical tree. A target that came back from the canonical tree is
 * MARKED in the card (`refFallback`), for the reason the reader route marks a fallback
 * page `noindex` and the catalog says «these lessons are in Spanish»: showing the other
 * language without saying so is the one option that is not honest.
 */

import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import type { Lesson } from "@/domain/types";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

import { getLesson } from "./registry";

const CANONICAL_LOCALE = routing.defaultLocale;

/** A lesson's place in the course — the only part of `Lesson` the rule needs. */
type Position = Pick<Lesson, "block" | "order">;

export interface LeccionCtx {
  courseSlug: string;
  /**
   * The REQUEST locale. Drives the URL prefix next-intl's `Link` applies and the card's
   * own copy — the chrome around the reference, not the content it resolves against.
   */
  locale: string;
  /**
   * The locale whose content tree a slug is tried in FIRST — `view.contentLocale`, the
   * tree this lesson's own prose came from. An untranslated lesson falls back to the
   * canonical locale (page.tsx), so looking a slug up under the request locale would
   * return `null` on `/en` and silently degrade EVERY reference to plain text. Same
   * distinction `enrollment-view.ts` records. COURSE-P11-01: it is the first step of the
   * lookup, not the only one — see `resolveTarget`.
   */
  contentLocale: string;
  current: Position;
}

export interface LeccionProps {
  slug?: string;
  /** A heading id in the target lesson. Validated by `validate-crosslinks.ts`. */
  ancla?: string;
  /** Set by `markBridgeReferences` (./bridge.ts), never by the author. */
  bridge?: boolean;
  children?: ReactNode;
}

/** A reference's target, and the locale tree it was actually found in. */
export interface ResolvedTarget {
  lesson: Lesson;
  locale: string;
}

/**
 * COURSE-P11-01 — resolve ONE reference the way `listLessonViews` resolves the spine:
 * the referring lesson's own content locale when the target is published there, the
 * canonical tree otherwise. `null` when the slug is in neither, which `lint:content`
 * makes unreachable in production.
 *
 * Drafts keep the behaviour the component depends on — `getLesson` is not draft-filtered,
 * so a draft target is FOUND and downgraded below rather than looking like a typo. The
 * new combination is a lesson drafted in `en/` and published in `es/`: a published
 * version wins wherever it lives, because it is the one the reader gets.
 *
 * Mirrors `resolveCrosslinkTarget` in ./validate-crosslinks.ts, which is the build-time
 * half of the same rule; the two must agree or the lint passes what the page degrades.
 */
export function resolveTarget(
  courseSlug: string,
  slug: string,
  contentLocale: string,
): ResolvedTarget | null {
  const locales =
    contentLocale === CANONICAL_LOCALE ? [contentLocale] : [contentLocale, CANONICAL_LOCALE];

  const found: ResolvedTarget[] = [];
  for (const locale of locales) {
    const lesson = getLesson(courseSlug, slug, locale);
    if (lesson) found.push({ lesson, locale });
  }

  return found.find((f) => !f.lesson.draft) ?? found[0] ?? null;
}

/** `true` when `target` comes after `current` in the (block, order) spine. */
export function isAhead(current: Position, target: Position): boolean {
  return (
    target.block > current.block ||
    (target.block === current.block && target.order > current.order)
  );
}

/**
 * Bind the component to the lesson being compiled. Same arrangement — and same reason —
 * as `<Quiz>` and `<CodeChallenge>` in `lessonMdxComponents`: a Server Component in the
 * MDX map cannot reach route params or frontmatter, so the compile-time facts are closed
 * over instead.
 */
export function makeLeccion(ctx: LeccionCtx) {
  return async function Leccion({ slug, ancla, bridge = false, children }: LeccionProps) {
    const resolved = slug ? resolveTarget(ctx.courseSlug, slug, ctx.contentLocale) : null;

    if (!resolved) {
      // Can't reach production: `pnpm lint:content` fails on an unresolved slug. In dev
      // we show a visible marker, mirroring `Quiz`, `CodeChallenge` and `Explorable`.
      if (process.env.NODE_ENV !== "production") {
        return (
          <span style={{ color: "var(--error)" }}>
            &lt;Leccion slug=&quot;{slug ?? ""}&quot;&gt; no resuelve a ninguna lección
          </span>
        );
      }
      return <>{children}</>;
    }

    const target = resolved.lesson;
    const label = children ?? target.title;
    const ahead = isAhead(ctx.current, target);
    // The target came from the other tree: its title and summary below are in that
    // language, and the card has to say so rather than let the reader discover it.
    const fallback = resolved.locale !== ctx.locale;

    // `getLesson` is deliberately NOT draft-filtered, so a draft target is found and
    // then downgraded here rather than looking like a typo to the lint.
    if (target.draft || (ahead && bridge)) return <>{label}</>;

    const t = await getTranslations({ locale: ctx.locale, namespace: "courses.reader" });
    const href = `/cursos/${ctx.courseSlug}/${target.slug}${ancla ? `#${ancla}` : ""}`;

    return (
      <span className="lesson-ref-wrap" data-ahead={ahead || undefined}>
        <Link href={href} className="lesson-ref">
          {label}
        </Link>
        {/* aria-hidden: the card repeats what the link already says, and reading five
            lines of summary on focus is worse than not reading them. */}
        <span className="lesson-ref-card" aria-hidden="true">
          <span className="lesson-ref-kicker">
            {ahead ? `${t("refAhead")} · ` : ""}
            {t("refKicker", { block: target.block, order: target.order })}
            {fallback ? ` · ${t("refFallback")}` : ""}
          </span>
          <span className="lesson-ref-title">{target.title}</span>
          <span className="lesson-ref-summary">{target.summary}</span>
        </span>
      </span>
    );
  };
}
