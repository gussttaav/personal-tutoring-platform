/**
 * LANDING-01 — the signed-in twin of "/". Never user-visible.
 *
 * "/" and "/en" stay fully static (SEO-01: Googlebot and every cookieless visitor
 * get the prerendered home with a 200). `src/middleware.ts` rewrites the home to
 * this route only when a NextAuth session cookie is present AND the request is a
 * landing (typed URL, bookmark, external link — not an in-app navigation, which
 * keeps the static home reachable), stamping the `x-landing-rewrite` request
 * header. This page then does what the Edge cannot:
 * auth() + `LandingService.resolve`, and a locale-aware redirect to the visitor's
 * real landing. The ladder itself lives in the service, not here.
 *
 * Three rules keep it loop-free:
 *   - No marker (someone typed /inicio) → redirect to "/". A signed-in visitor then
 *     goes "/" → rewrite (with marker) → resolved; nobody can browse a second home.
 *   - Marker but no session (stale/invalid cookie) → RENDER the home here, at "/".
 *     Redirecting to "/" would rewrite straight back (the cookie is still there).
 *   - Resolution failure → the personal area (rule 4's default), never a 500 on "/".
 *
 * Metadata is the home's (the only HTML this route emits IS the home, served at
 * "/"), so no `robots` override — a noindex there would be a noindex on "/".
 * `robots.ts` disallows /inicio so crawlers never even request it.
 */

import { headers } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { landingService } from "@/services";
import { log } from "@/lib/logger";
import { registryCourseMeta } from "@/lib/courses/enrollment-view";
import type { LandingDestination } from "@/domain/types";
import HomePage, { generateMetadata as homeMetadata } from "../page";

const LANDING_MARKER = "x-landing-rewrite";

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return homeMetadata(props);
}

export default async function InicioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  if ((await headers()).get(LANDING_MARKER) !== "1") redirect({ href: "/", locale });

  const session = await auth();
  const email   = session?.user?.email;
  if (!email) return <HomePage params={params} />;

  let dest: LandingDestination;
  try {
    dest = await landingService.resolve(email, isAdmin(session));
  } catch (err) {
    log("error", "Landing resolution failed — falling back to the personal area", {
      service: "landing", error: String(err),
    });
    dest = { kind: "personal-area" };
  }

  // Course landings are generated per locale from their manifests. A course with no
  // manifest for THIS locale resolves to the canonical one (the same fallback the
  // personal area's course card uses); a slug the registry no longer knows at all
  // falls back to the personal area.
  if (dest.kind === "course") {
    const meta = registryCourseMeta(locale)(dest.courseSlug);
    if (meta) redirect({ href: `/cursos/${dest.courseSlug}`, locale: meta.locale });
    dest = { kind: "personal-area" };
  }

  redirect({ href: dest.kind === "admin" ? "/admin" : "/area-personal", locale });
}
