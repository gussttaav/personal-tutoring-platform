import { isValidOrigin } from "@/lib/csrf";

function mockReq(origin: string | null): any {
  return { headers: { get: (k: string) => (k === "origin" ? origin : null) } };
}

function reqWithHeaders(headers: Record<string, string>): any {
  return { headers: { get: (k: string) => headers[k] ?? null } };
}

const BASE = "https://www.gustavoai.dev";

describe("isValidOrigin", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = BASE;
  });

  it("accepts the configured origin", () => {
    expect(isValidOrigin(mockReq("https://www.gustavoai.dev"))).toBe(true);
  });

  it("rejects a different origin", () => {
    expect(isValidOrigin(mockReq("https://evil.com"))).toBe(false);
  });

  it("rejects missing origin", () => {
    expect(isValidOrigin(mockReq(null))).toBe(false);
  });

  it("rejects malformed origin", () => {
    expect(isValidOrigin(mockReq("not-a-url"))).toBe(false);
  });

  it("rejects when NEXT_PUBLIC_BASE_URL is not set", () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    expect(isValidOrigin(mockReq("https://www.gustavoai.dev"))).toBe(false);
  });

  // REFACTOR-P2-04: Sec-Fetch-Site tests
  it("allows same-origin requests", () => {
    expect(isValidOrigin(reqWithHeaders({
      "origin": BASE,
      "sec-fetch-site": "same-origin",
    }))).toBe(true);
  });

  it("denies cross-site requests even when origin happens to match", () => {
    expect(isValidOrigin(reqWithHeaders({
      "origin": BASE,
      "sec-fetch-site": "cross-site",
    }))).toBe(false);
  });

  it("allows same-site requests (future subdomain support)", () => {
    expect(isValidOrigin(reqWithHeaders({
      "origin": BASE,
      "sec-fetch-site": "same-site",
    }))).toBe(true);
  });

  it("falls back to origin check when sec-fetch-site is absent", () => {
    expect(isValidOrigin(reqWithHeaders({
      "origin": BASE,
    }))).toBe(true);
  });

  it("denies when origin mismatches regardless of sec-fetch-site", () => {
    expect(isValidOrigin(reqWithHeaders({
      "origin": "https://evil.example.com",
      "sec-fetch-site": "cross-site",
    }))).toBe(false);
  });

  it("denies when origin is absent and sec-fetch-site is absent", () => {
    expect(isValidOrigin(reqWithHeaders({}))).toBe(false);
  });
});
