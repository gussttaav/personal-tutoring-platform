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
 */

import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import type { Lesson } from "@/domain/types";
import { Link } from "@/i18n/navigation";

import { getLesson } from "./registry";

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
   * The locale whose content tree the slug resolves against — `view.contentLocale`.
   * An untranslated lesson falls back to the canonical locale (page.tsx), so looking a
   * slug up under the request locale would return `null` on `/en` and silently degrade
   * EVERY reference to plain text. Same distinction `enrollment-view.ts` records.
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
    const target = slug ? getLesson(ctx.courseSlug, slug, ctx.contentLocale) : null;

    if (!target) {
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

    const label = children ?? target.title;
    const ahead = isAhead(ctx.current, target);

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
          </span>
          <span className="lesson-ref-title">{target.title}</span>
          <span className="lesson-ref-summary">{target.summary}</span>
        </span>
      </span>
    );
  };
}
