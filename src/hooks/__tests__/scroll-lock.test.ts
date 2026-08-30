// COURSE-P9-01 — The lock must survive two overlapping overlays (drawer + search dialog).

import { createScrollLock, type ScrollLockTarget } from "@/hooks/scroll-lock";

function fakeTarget(initial = ""): ScrollLockTarget & { value: string } {
  return {
    value: initial,
    read() { return this.value; },
    write(v: string) { this.value = v; },
  };
}

describe("createScrollLock", () => {
  it("locks and restores for a single holder", () => {
    const t = fakeTarget();
    const release = createScrollLock(t).lock();
    expect(t.value).toBe("hidden");
    release();
    expect(t.value).toBe("");
  });

  it("stays locked until the LAST holder releases", () => {
    const t = fakeTarget();
    const s = createScrollLock(t);
    const drawer = s.lock();
    const dialog = s.lock();
    dialog();
    // The drawer is still open — precisely the bug the counter exists to prevent.
    expect(t.value).toBe("hidden");
    drawer();
    expect(t.value).toBe("");
  });

  it("ignores a repeated release, as a StrictMode double-cleanup would cause", () => {
    const t = fakeTarget();
    const s = createScrollLock(t);
    const a = s.lock();
    const b = s.lock();
    a(); a(); a();
    expect(t.value).toBe("hidden");
    b();
    expect(t.value).toBe("");
  });

  it("restores whatever value was there before, not a hardcoded empty string", () => {
    const t = fakeTarget("clip");
    const release = createScrollLock(t).lock();
    release();
    expect(t.value).toBe("clip");
  });
});
