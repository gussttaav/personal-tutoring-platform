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
 * `/mentoria?book=smart` rather than a dispatched event: `open-smart-book` — what the
 * hero fires — has exactly one listener, inside `InteractiveShell`, which is mounted
 * only on `/mentoria`. Firing it here would be a silent no-op, the same failure
 * `#sessions` had from /cursos (see Footer.tsx). The `?book=` deep link is the
 * established bridge from another page, and `book=smart` routes through the very same
 * `handleSmartBook()` the hero button calls.
 *
 * `locale`, never `contentLocale`: an English reader on a Spanish-fallback lesson gets
 * English chrome. See Leccion.tsx for the same distinction spelled out.
 *
 * `rel="nofollow"`: `/mentoria` is already canonical, but 43 indexed lesson pages all
 * pointing at `/mentoria?book=smart` is a crawl signal worth not sending.
 *
 * CONTENT-AUTHOR-01: the card is SIGNED. The course landing and the blog post both
 * carry the full `AuthorBio` card; a lesson cannot, because this card is already the
 * last thing in the article and an author card beside it would make the same ask twice.
 * Signing costs one row, and it gives `body` ("Reserva una sesión CONMIGO") the
 * antecedent it never had: nothing else in the reader names the author.
 *
 * Layout: heading and body across the full width, then signature and button together on
 * the bottom row. The button used to sit in a second column, centred against the text —
 * which the signature threw off, leaving the button floating beside the body with dead
 * space under it. Sharing a row puts the face next to the action it belongs to and hands
 * the copy the card's whole measure.
 */

import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AUTHOR_AVATAR, AUTHOR_NAME } from "@/features/content/author";

interface LessonCtaProps {
  /** The REQUEST locale — the language of the chrome, not of the prose. */
  locale: string;
}

export default async function LessonCta({ locale }: LessonCtaProps) {
  const t = await getTranslations({ locale, namespace: "courses.reader.cta" });

  return (
    <aside className="lesson-cta">
      <p className="lesson-cta-heading">{t("heading")}</p>
      <p className="lesson-cta-body">{t("body")}</p>

      {/* The signature and the button share the bottom row: the offer is signed and
          taken in one place, and the copy above gets the card's full measure. */}
      <div className="lesson-cta-foot">
        <span className="lesson-cta-sign">
          <Image
            className="lesson-cta-sign__avatar"
            src={AUTHOR_AVATAR}
            alt=""
            width={32}
            height={32}
          />
          {AUTHOR_NAME}
        </span>

        <Link href="/mentoria?book=smart" rel="nofollow" className="lesson-cta-button">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: "1.2rem" }}>
            calendar_add_on
          </span>
          {t("button")}
        </Link>
      </div>
    </aside>
  );
}
