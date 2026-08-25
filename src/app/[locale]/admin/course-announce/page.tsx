/**
 * COURSE-P6-02b — admin course announcements.
 * Auth/admin gating is handled by the admin layout.
 *
 * The course list comes from the content registry rather than a free-text slug field: the
 * route 404s an unknown slug anyway, and there is no reason to let a typo get as far as the
 * confirm button on the one screen in this panel that sends real email.
 */

import { PageHeader, Card } from "@/components/admin/ui";
import { CourseAnnounceForm } from "@/components/admin/CourseAnnounceForm";
import { listCatalogEntries } from "@/lib/courses/catalog-view";
import { routing } from "@/i18n/routing";

export default async function CourseAnnouncePage() {
  const courses = listCatalogEntries(routing.defaultLocale).map((entry) => ({
    slug:  entry.course.slug,
    title: entry.course.title,
  }));

  return (
    <div className="page-stack">
      <PageHeader
        overline="Comunicación"
        title="Anuncios"
        subtitle="Avisa por correo a quien se ha suscrito a los cursos. Previsualiza siempre antes de enviar: esto no se puede deshacer."
      />

      <Card>
        <CourseAnnounceForm courses={courses} />
      </Card>
    </div>
  );
}
