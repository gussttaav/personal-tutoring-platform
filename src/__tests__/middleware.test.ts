/**
 * SEO-01: middleware locale-routing tests.
 *
 * The canonical Spanish root ("/") must never redirect based on
 * Accept-Language: Googlebot crawls cookieless and a 307 → /en makes "/"
 * fail indexing in Search Console ("Page with redirect"). Locale detection
 * is pathname prefix → NEXT_LOCALE cookie → defaultLocale (es); the
 * Accept-Language header is stripped in the middleware before next-intl runs.
 *
 * LANDING-01: the home is rewritten to the dynamic `/inicio` twin when — and
 * only when — a NextAuth session cookie is present AND the request is a landing
 * (not a `Sec-Fetch-Site: same-origin` in-app navigation). A rewrite is not a
 * redirect, so every SEO-01 assertion above still holds for the cookieless case.
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

describe("LANDING-01: the home is rewritten to /inicio for a session cookie", () => {
  const SESSION = "authjs.session-token=jwt";
  const rewrite = (res: Response) => new URL(res.headers.get("x-middleware-rewrite")!);

  it("rewrites / to /es/inicio — a rewrite, not a redirect", () => {
    const res = middleware(request("/", { cookie: SESSION }));
    expect(isRedirect(res)).toBe(false);
    expect(rewrite(res).pathname).toBe("/es/inicio");
  });

  it("rewrites /en to /en/inicio", () => {
    expect(rewrite(middleware(request("/en", { cookie: SESSION }))).pathname).toBe("/en/inicio");
  });

  it("accepts the __Secure- cookie variant (production)", () => {
    const res = middleware(request("/", { cookie: "__Secure-authjs.session-token=jwt" }));
    expect(rewrite(res).pathname).toBe("/es/inicio");
  });

  it("forwards the marker and the request id on the rewritten request", () => {
    const res = middleware(request("/", { cookie: SESSION, "x-request-id": "req_abc123" }));
    expect(res.headers.get("x-request-id")).toBe("req_abc123");
    expect(res.headers.get("x-middleware-request-x-request-id")).toBe("req_abc123");
    expect(res.headers.get("x-middleware-request-x-landing-rewrite")).toBe("1");
  });

  it("keeps the query string", () => {
    const url = rewrite(middleware(request("/?foo=bar", { cookie: SESSION })));
    expect(url.pathname).toBe("/es/inicio");
    expect(url.searchParams.get("foo")).toBe("bar");
  });

  it("still 307s / to /en for NEXT_LOCALE=en — the switcher wins before the landing", () => {
    const res = middleware(request("/", { cookie: `${SESSION}; NEXT_LOCALE=en` }));
    expect(isRedirect(res)).toBe(true);
    expect(res.headers.get("location")).toMatch(/\/en$/);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("does NOT touch a cookieless / — Googlebot keeps next-intl's static /es rewrite", () => {
    expect(rewrite(middleware(request("/"))).pathname).toBe("/es");
  });

  it("leaves other UI paths alone (/mentoria with a session cookie)", () => {
    expect(rewrite(middleware(request("/mentoria", { cookie: SESSION }))).pathname).toBe("/es/mentoria");
  });

  it("lets an in-app navigation reach the static home (Sec-Fetch-Site: same-origin)", () => {
    const es = middleware(request("/", { cookie: SESSION, "sec-fetch-site": "same-origin" }));
    expect(isRedirect(es)).toBe(false);
    expect(rewrite(es).pathname).toBe("/es"); // next-intl's own rewrite, not /inicio
    expect(es.headers.get("x-middleware-request-x-landing-rewrite")).toBeNull();

    // /en already carries its locale: next-intl passes it through untouched.
    const en = middleware(request("/en", { cookie: SESSION, "sec-fetch-site": "same-origin" }));
    expect(isRedirect(en)).toBe(false);
    expect(en.headers.get("x-middleware-rewrite")).toBeNull();
    expect(en.headers.get("x-middleware-request-x-landing-rewrite")).toBeNull();
  });

  it("treats a typed URL, an external link and a header-less request as landings", () => {
    for (const site of ["none", "cross-site", "same-site", undefined]) {
      const headers: Record<string, string> = { cookie: SESSION };
      if (site) headers["sec-fetch-site"] = site;
      expect(rewrite(middleware(request("/", headers))).pathname).toBe("/es/inicio");
    }
  });

  it("strips a spoofed marker from a direct /inicio request", () => {
    const res = middleware(request("/inicio", { "x-landing-rewrite": "1", cookie: SESSION }));
    expect(res.headers.get("x-middleware-request-x-landing-rewrite")).toBeNull();
    expect(rewrite(res).pathname).toBe("/es/inicio");
  });
});
