/*
 * BLOG-03 / COURSE-P12 — the reusable "copy" button itself.
 *
 * Deliberately host-agnostic: it copies whatever `getText()` returns and knows nothing
 * about where it sits. Two callers use it —
 *   - `CodeCopyButtons` portals one into each static fenced block (reads the block's
 *     source back out of the highlighted DOM);
 *   - `PyCellClient` renders one over a runnable cell while it shows its read-only
 *     highlight, passing the cell's current source directly.
 *
 * The hover-reveal, positioning and copied-state styling live in `code-copy.css`, keyed
 * on a `.code-copy-host` ancestor (or the `[data-rehype-pretty-code-figure]` wrapper),
 * so a host only has to mark itself and drop the button inside.
 */

"use client";

import "./code-copy.css";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export function CopyButton({ getText }: { getText: () => string }) {
  const t = useTranslations("code");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Clear a pending "Copied" reset if the host unmounts mid-timeout — e.g. a PyCell
  // swapping to its editor removes the button while the 2s timer is still live.
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    const text = getText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable (older browser / non-secure context). Fall back to
      // the legacy path; if that also fails, leave the button silent rather than throw.
      if (!legacyCopy(text)) return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  const label = copied ? t("copied") : t("copy");
  return (
    <button
      type="button"
      className="code-copy-btn"
      onClick={copy}
      aria-label={label}
      title={label}
      data-copied={copied ? "" : undefined}
    >
      <span className="code-copy-btn__icon" aria-hidden>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </span>
    </button>
  );
}

/** Last-resort copy for contexts without the async Clipboard API. Returns success. */
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default CopyButton;
