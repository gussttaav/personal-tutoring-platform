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
 * The matcher excludes static assets and image optimization endpoints.
 */

import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const requestId =
    req.headers.get("x-request-id") ??
    `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

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
