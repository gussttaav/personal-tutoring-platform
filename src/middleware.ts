/**
 * REFACTOR-P4-02: Request ID propagation.
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
 * The matcher excludes static assets and image optimization endpoints.
 */

import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export function middleware(req: NextRequest) {
  const requestId =
    req.headers.get("x-request-id") ??
    `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  const { pathname } = req.nextUrl;

  // UI routes get locale routing; API/monitoring stay request-id only so their
  // fixed URLs (Stripe webhook, NextAuth, QStash, Resend, Sentry tunnel) are
  // never rewritten under a locale prefix.
  const isUiPath =
    !pathname.startsWith("/api") && !pathname.startsWith("/monitoring");

  if (isUiPath) {
    // Inject the request ID onto the incoming request headers so server
    // components and route handlers can read it during this request.
    req.headers.set("x-request-id", requestId);
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
