/*
 * CONTENT-FEEDBACK-01 — the clipboard write shared by CopyButton (code blocks) and
 * ContentFeedback (share link). Lifted verbatim out of CopyButton.tsx so the two
 * callers cannot drift on the fallback: the async Clipboard API first, the legacy
 * `execCommand` path when that is unavailable (older browser / non-secure
 * context), and a plain `false` — never a throw — when both fail, so a host can
 * stay silent rather than crash.
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyCopy(text);
  }
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
