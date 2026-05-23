/**
 * REL-03 — Unit tests for the isAdmin helper.
 */

import { isAdmin } from "@/lib/admin";
import type { Session } from "next-auth";

function makeSession(email: string): Session {
  return {
    user:    { email, name: "Test User", isAdmin: false },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  };
}

// ─── isAdmin ──────────────────────────────────────────────────────────────────

describe("isAdmin", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = "tutor@example.com,admin@example.com";
  });

  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  it("accepts an exact-match email", () => {
    expect(isAdmin(makeSession("tutor@example.com"))).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isAdmin(makeSession("TUTOR@EXAMPLE.COM"))).toBe(true);
    expect(isAdmin(makeSession("Admin@Example.Com"))).toBe(true);
  });

  it("rejects an email not in the list", () => {
    expect(isAdmin(makeSession("stranger@example.com"))).toBe(false);
  });

  it("rejects when ADMIN_EMAILS is empty", () => {
    process.env.ADMIN_EMAILS = "";
    expect(isAdmin(makeSession("tutor@example.com"))).toBe(false);
  });

  it("rejects a null session", () => {
    expect(isAdmin(null)).toBe(false);
  });
});
