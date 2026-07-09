/**
 * SEO-01: middleware locale-routing tests.
 *
 * The canonical Spanish root ("/") must never redirect based on
 * Accept-Language: Googlebot crawls cookieless and a 307 → /en makes "/"
 * fail indexing in Search Console ("Page with redirect"). Locale detection
 * is pathname prefix → NEXT_LOCALE cookie → defaultLocale (es); the
 * Accept-Language header is stripped in the middleware before next-intl runs.
 */

import { NextRequest } from "next/server";
import { middleware } from "../middleware";

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://gustavoai.dev${path}`, { headers });
}

function isRedirect(res: Response) {
  return res.status >= 300 && res.status < 400;
}

describe("middleware locale routing (SEO-01)", () => {
  it("serves / without redirect for a cookieless English browser (Googlebot case)", () => {
    const res = middleware(request("/", { "accept-language": "en-US,en;q=0.9" }));
    expect(isRedirect(res)).toBe(false);
    expect(res.headers.get("location")).toBeNull();
  });

  it("serves / without redirect for a cookieless non-Spanish, non-English browser", () => {
    const res = middleware(request("/", { "accept-language": "de-DE,de;q=0.9" }));
    expect(isRedirect(res)).toBe(false);
  });

  it("serves / without redirect when there is no Accept-Language header", () => {
    const res = middleware(request("/"));
    expect(isRedirect(res)).toBe(false);
  });

  it("still honors the NEXT_LOCALE=en cookie on / (language switcher persistence)", () => {
    const res = middleware(request("/", { cookie: "NEXT_LOCALE=en" }));
    expect(isRedirect(res)).toBe(true);
    expect(res.headers.get("location")).toMatch(/\/en$/);
  });

  it("keeps serving /en without redirect", () => {
    const res = middleware(request("/en", { "accept-language": "en-US,en;q=0.9" }));
    expect(isRedirect(res)).toBe(false);
  });

  it("keeps serving Spanish pages for a NEXT_LOCALE=es cookie without redirect", () => {
    const res = middleware(request("/", { cookie: "NEXT_LOCALE=es" }));
    expect(isRedirect(res)).toBe(false);
  });

  it("attaches x-request-id to UI responses", () => {
    const res = middleware(request("/"));
    expect(res.headers.get("x-request-id")).toMatch(/^req_[0-9a-f]{16}$/);
  });

  it("passes API routes through with request-id tracing and no locale redirect", () => {
    const res = middleware(
      request("/api/health", { "accept-language": "en-US", "x-request-id": "req_abc123" }),
    );
    expect(isRedirect(res)).toBe(false);
    expect(res.headers.get("x-request-id")).toBe("req_abc123");
  });
});
