/*
 * COURSE-P9-01 — Ref-counted body scroll lock.
 *
 * Not a hook; a plain module, like ./course-progress-state.ts beside it.
 *
 * WHY THIS EXISTS. `MobileLessonBar` used to set `document.body.style.overflow` directly
 * on open and clear it on close. That is correct for exactly one overlay. The search
 * dialog is a second one, and it can be opened from inside the drawer — so the dialog's
 * close would clear the lock while the drawer is still open, silently unlocking the page
 * behind it. Counting is the fix: the lock lifts only when the last holder releases.
 *
 * The counter is separated from the DOM behind `ScrollLockTarget` so it can be unit
 * tested: `pnpm test:unit` runs in the `node` environment and this repo has no jsdom
 * (jest.config.js), so a test that touched `document` could not run at all.
 */

export interface ScrollLockTarget {
  read():  string;
  write(value: string): void;
}

export interface ScrollLock {
  /** Take the lock. Returns the release function; calling it twice is a no-op. */
  lock(): () => void;
}

export function createScrollLock(target: ScrollLockTarget): ScrollLock {
  let holders = 0;
  /** The value to restore — captured from the first holder, never assumed to be "". */
  let restore = "";

  return {
    lock() {
      if (holders === 0) {
        restore = target.read();
        target.write("hidden");
      }
      holders += 1;

      let released = false;
      return () => {
        // Idempotent: a React effect cleanup can run twice under StrictMode, and
        // double-decrementing would unlock the page with an overlay still up.
        if (released) return;
        released = true;
        holders = Math.max(0, holders - 1);
        if (holders === 0) target.write(restore);
      };
    },
  };
}

const domLock = createScrollLock({
  read:  () => (typeof document === "undefined" ? "" : document.body.style.overflow),
  write: (value) => {
    if (typeof document !== "undefined") document.body.style.overflow = value;
  },
});

/** Lock body scroll. Returns the release function. */
export function lockBodyScroll(): () => void {
  return domLock.lock();
}
