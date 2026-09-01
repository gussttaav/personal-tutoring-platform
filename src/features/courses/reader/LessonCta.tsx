/*
 * COURSE-P10-01 — the in-lesson booking CTA, last thing in the article.
 *
 * Server Component, no client JS: it is a link, and the reader route pays for every
 * kilobyte of first-load JS (scripts/check-bundle.ts). Hover/focus live in lesson.css
 * (`.lesson-cta*`) for the same reason `LessonNav`'s do — an inline `style` object
 * cannot express either.
 *
 * Placement (LessonLayout): AFTER `LessonNav`, not before it. Mark-complete → next
 * lesson is the study loop, and putting an offer inside it buys attention by
 * interrupting the thing the reader came for. It also renders for a signed-out
 * reader, unlike `LessonComplete`, which returns null when progress is untracked.
 *
 * `/?book=smart` rather than a dispatched event: `open-smart-book` — what the landing
 * hero fires — has exactly one listener, inside `InteractiveShell`, which is mounted
 * only on the landing page. Firing it here would be a silent no-op, the same failure
 * `#sessions` had from /cursos (see Footer.tsx). The `?book=` deep link is the
 * established bridge from another page, and `book=smart` routes through the very same
 * `handleSmartBook()` the hero button calls.
 *
 * `locale`, never `contentLocale`: an English reader on a Spanish-fallback lesson gets
 * English chrome. See Leccion.tsx for the same distinction spelled out.
 *
 * `rel="nofollow"`: `/` is already canonical, but 43 indexed lesson pages all pointing
 * at `/?book=smart` is a crawl signal worth not sending.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

interface LessonCtaProps {
  /** The REQUEST locale — the language of the chrome, not of the prose. */
  locale: string;
}

export default async function LessonCta({ locale }: LessonCtaProps) {
  const t = await getTranslations({ locale, namespace: "courses.reader.cta" });

  return (
    <aside className="lesson-cta">
      <div className="lesson-cta-text">
        <p className="lesson-cta-heading">{t("heading")}</p>
        <p className="lesson-cta-body">{t("body")}</p>
      </div>

      <Link href="/?book=smart" rel="nofollow" className="lesson-cta-button">
        <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: "1.2rem" }}>
          calendar_add_on
        </span>
        {t("button")}
      </Link>
    </aside>
  );
}
