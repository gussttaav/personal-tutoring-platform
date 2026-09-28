/*
 * REDESIGN-P1-03 — home (/) courses band.
 *
 * Server Component. Reuses `CourseCard` untouched and the same `listCatalogEntries(locale)`
 * selector the catalog page (`cursos/page.tsx`) uses, so the home can never disagree with
 * `/cursos` (the `COURSE-P6-03` rule: one selector, one truth). COURSE-BUILD-01 made that
 * literal: the counts and status the card needs are fields on the entry now, so both pages hand
 * the entry over instead of each deriving its own props. Only the two-column grid around the
 * cards is new (`.home-courses-grid`, `src/features/home/home.css`).
 *
 * `listCatalogEntries` is published-only, so a locale can be empty; renders nothing rather
 * than a section head over an empty grid.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import CourseCard from "@/features/courses/catalog/CourseCard";
import { listCatalogEntries } from "@/lib/courses/catalog-view";

interface HomeCoursesProps {
  locale: string;
}

export default async function HomeCourses({ locale }: HomeCoursesProps) {
  const t = await getTranslations({ locale, namespace: "courses.catalog" });
  const tHome = await getTranslations({ locale, namespace: "home.courses" });

  const cards = listCatalogEntries(locale);

  if (cards.length === 0) return null;

  return (
    <section style={{ padding: "72px 0" }}>
      <div className="lp-section-head">
        <span className="lp-kicker">{t("overline")}</span>
        <span className="lp-rule" />
        <Link href="/cursos" className="home-see-all">
          {tHome("seeAll")}
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "1.125rem" }}
            aria-hidden="true"
          >
            arrow_forward
          </span>
        </Link>
      </div>

      <div className="home-courses-grid">
        {cards.map((entry) => (
          <CourseCard
            key={entry.course.slug}
            course={entry.course}
            lessonCount={entry.lessons.length}
            build={entry.build}
            locale={locale}
            contentLocale={entry.contentLocale}
            fullyTranslated={entry.fullyTranslated}
            translatedCount={entry.translatedCount}
          />
        ))}
      </div>
    </section>
  );
}
