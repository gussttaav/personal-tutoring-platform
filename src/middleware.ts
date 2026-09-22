/**
 * REFACTOR-P4-02: Request ID propagation.
 * SEO-01: Accept-Language locale detection removed.
 *
 * Generates an x-request-id (or honors an incoming one — e.g. from a frontend
 * client that already has a trace context) and attaches it to the response so
 * the browser network panel shows it.
 *
 * Middleware runs in the Edge runtime, where AsyncLocalStorage is NOT available,
 * so it only forwards the ID via header. Route handlers (Node runtime) opt into
 * `tracedRoute` to seed the ALS store from that header.
 *
 * i18n (Phase 1): next-intl locale routing is composed on top of request-ID
 * tracing. UI routes pass through the next-intl middleware (locale rewrite /
 * `/en` prefix handling); `/api` and `/monitoring` are deliberately NOT
 * locale-rewritten and only receive request-ID tracing.
 *
 * SEO-01: locale detection is pathname prefix → NEXT_LOCALE cookie →
 * defaultLocale (es). Accept-Language is deliberately stripped before next-intl
 * runs (see below); a cookieless request for "/" is always served Spanish with
 * a 200 instead of being 307-redirected to "/en". Googlebot crawls cookieless,
 * so the redirect made the canonical Spanish root fail indexing in Google
 * Search Console ("Page with redirect").
 *
 * LANDING-01: a visitor who LANDS on the home ("/" or "/en") with a NextAuth
 * session cookie is REWRITTEN (URL unchanged) to the dynamic twin at
 * `/[locale]/inicio`, which runs auth() and sends them to their real landing
 * (admin panel, personal area or the course they are reading). Only cookie
 * PRESENCE is checked here: the JWT is never decoded on the Edge — `src/auth.ts`
 * imports the Supabase services and `next/headers`, neither of which can run in
 * this runtime — and the twin renders the home in place when the cookie turns out
 * to be stale. A cookieless "/" (Googlebot, every anonymous visitor) never enters
 * this branch, so SEO-01's static 200 is untouched.
 *
 * "Lands" means arriving from OUTSIDE the app: a typed URL or bookmark
 * (`Sec-Fetch-Site: none`) or a link on another site (`cross-site` / `same-site`).
 * Navigating to the home from inside the app — «Inicio», the logo, a reload once
 * there, the router's RSC fetches — is `same-origin` and gets the static home, so
 * a signed-in visitor can still read it. A browser that sends no Sec-Fetch-Site
 * (Safari < 16.4, curl) is treated as landing, i.e. redirected.
 *
 * The matcher excludes static assets and image optimization endpoints.
 */

import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

// LANDING-01: NextAuth v5 defaults — the plain name in dev, the `__Secure-` one
// over https (same pair `src/app/api/test/auth/route.ts` mints for e2e).
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];
/** Request header stamped on the rewrite so `/inicio` knows it was reached through
 *  here and not typed into the address bar. */
const LANDING_MARKER = "x-landing-rewrite";

/** LANDING-01: an in-app navigation (link, reload, RSC fetch) is `same-origin`;
 *  everything else — typed URL, bookmark, external link, no header — is a landing. */
function isLanding(req: NextRequest): boolean {
  return req.headers.get("sec-fetch-site") !== "same-origin";
}

/**
 * LANDING-01: the locale of the home this request asks for, or `null` when it is
 * not the home. "/" is Spanish unless the switcher cookie says English — that case
 * is next-intl's 307 to "/en" (kept as-is), and the "/en" request then lands here.
 */
function homeLocale(req: NextRequest): "es" | "en" | null {
  const { pathname } = req.nextUrl;
  if (pathname === "/en") return "en";
  if (pathname === "/" && req.cookies.get("NEXT_LOCALE")?.value !== "en") return "es";
  return null;
}

export function middleware(req: NextRequest) {
  const requestId =
    req.headers.get("x-request-id") ??
    `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  const { pathname } = req.nextUrl;

  // UI routes get locale routing; API/monitoring and static assets stay
  // request-id only. Static files (e.g. /site.webmanifest, /avatar.png) must
  // bypass intlMiddleware: on Vercel the edge middleware runs before static
  // file serving, so any rewrite/response from intlMiddleware takes precedence
  // and would prevent the file from being served correctly.
  const isUiPath =
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/monitoring") &&
    !/\.[^/]+$/.test(pathname);

  if (isUiPath) {
    // Inject the request ID onto the incoming request headers so server
    // components and route handlers can read it during this request.
    req.headers.set("x-request-id", requestId);
    // SEO-01: strip Accept-Language so next-intl never locale-detects from it.
    // Detection becomes: pathname prefix → NEXT_LOCALE cookie → defaultLocale
    // (es). The switcher-set cookie still wins for returning users, while a
    // cookieless "/" (e.g. Googlebot) gets 200 Spanish instead of 307 → /en.
    req.headers.delete("accept-language");

    // LANDING-01: the marker is set ONLY by the rewrite below — never trust it
    // from the network (next-intl forwards req.headers to the rendered route).
    req.headers.delete(LANDING_MARKER);

    // LANDING-01: a visitor who lands here with a session cookie does not get the
    // marketing home; one who navigates to it from inside the app does.
    const locale = homeLocale(req);
    if (locale && isLanding(req) && SESSION_COOKIES.some((name) => req.cookies.has(name))) {
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}/inicio`; // the query string rides along
      const headers = new Headers(req.headers); // already carries x-request-id
      headers.set(LANDING_MARKER, "1");
      const res = NextResponse.rewrite(url, { request: { headers } });
      res.headers.set("x-request-id", requestId);
      return res;
    }

    const res = intlMiddleware(req);
    res.headers.set("x-request-id", requestId);
    return res;
  }

  const res = NextResponse.next({
    request: { headers: new Headers([...req.headers.entries(), ["x-request-id", requestId]]) },
  });
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  matcher: [
    // Match everything except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|monitoring).*)",
  ],
};
