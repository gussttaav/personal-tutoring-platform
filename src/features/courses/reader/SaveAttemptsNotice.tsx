"use client";

/*
 * COURSE-P4-04 — "your answers are not being saved", for signed-out readers.
 *
 * Shown by both assessment cards, and ONLY after the reader has actually submitted
 * something. Before that the page stays exactly as clean as it is today: reading
 * requires no account (P4-02's `LessonComplete` makes the same call, which is why
 * that component renders nothing at all when untracked). The moment they do work
 * that would have been saved, telling them it wasn't is honest rather than nagging.
 *
 * Same-tab redirect via `signIn`, not the popup helper: the popup exists to keep a
 * booking flow's page state alive, and there is nothing here worth preserving — the
 * attempt will be re-answerable, and now recorded, when they come back.
 *
 * `signIn` is imported lazily, inside the handler. Both assessment cards import this
 * component statically and they are reachable from `mdx-components.tsx`, so a
 * top-level `next-auth/react` import would drag an ESM-only package into the MDX
 * component graph — which the Node-environment unit tests load directly. Same
 * reasoning as `mdx.ts`'s lazy `compileMDX` import; the click can afford the await.
 */

import { useTranslations } from "next-intl";

export function SaveAttemptsNotice() {
  const t = useTranslations("courses.progress");

  return (
    <p
      style={{
        margin: "0.9rem 0 0",
        fontSize: "0.8rem",
        color: "var(--text-dim)",
      }}
    >
      {t("saveAttempts")}{" "}
      <button
        type="button"
        onClick={async () => {
          const { signIn } = await import("next-auth/react");
          signIn("google", { callbackUrl: window.location.href });
        }}
        style={{
          padding: 0,
          border: "none",
          background: "none",
          color: "var(--green)",
          font: "inherit",
          textDecoration: "underline",
          cursor: "pointer",
        }}
      >
        {t("saveAttemptsCta")}
      </button>
    </p>
  );
}

export default SaveAttemptsNotice;
