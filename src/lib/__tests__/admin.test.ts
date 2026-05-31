/**
 * REFACTOR-P2-02 — Unit tests for the isAdmin helper.
 */

import { isAdmin } from "@/lib/admin";
import type { Session } from "next-auth";

describe("isAdmin", () => {
  it("returns true when session.user.isAdmin is true", () => {
    expect(isAdmin({ user: { isAdmin: true } } as Session)).toBe(true);
  });

  it("returns false when session.user.isAdmin is false", () => {
    expect(isAdmin({ user: { isAdmin: false } } as Session)).toBe(false);
  });

  it("returns false when session is null", () => {
    expect(isAdmin(null)).toBe(false);
  });
});
