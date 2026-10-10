/**
 * BLOG-15 — admin blog post announcements.
 * SEC-07: gated before its own data fetch — see students/page.tsx sibling note
 * (the layout's redirect alone does not stop this page's data fetch from running).
 *
 * The post list comes from the blog registry (published Spanish posts, newest first — every
 * post is written in Spanish first), so the slug the form posts is always one the route can
 * resolve. Each option carries the locales the post exists in, to flag a Spanish-only one.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { PageHeader, Card } from "@/components/admin/ui";
import { BlogAnnounceForm } from "@/components/admin/BlogAnnounceForm";
import { listPosts } from "@/lib/blog/registry";
import { registryBlogPostCatalog } from "@/lib/blog/post-catalog";
import { routing } from "@/i18n/routing";

export default async function BlogAnnouncePage() {
  if (!isAdmin(await auth())) redirect("/");

  const posts = listPosts(routing.defaultLocale).map((post) => ({
    slug:    post.slug,
    title:   post.title,
    date:    post.date,
    areas:   post.areas,
    locales: registryBlogPostCatalog.locales(post.slug),
  }));

  return (
    <div className="page-stack">
      <PageHeader
        overline="Comunicación"
        title="Avisos del blog"
        subtitle="Avisa por correo de un artículo nuevo a quien sigue sus áreas. Antes de enviar verás a cuántas personas llega; esto no se puede deshacer."
      />

      <Card>
        <BlogAnnounceForm posts={posts} />
      </Card>
    </div>
  );
}
