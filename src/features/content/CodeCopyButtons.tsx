/*
 * BLOG-03 / COURSE-P12 — hover-reveal "copy" buttons on static fenced code blocks,
 * shared by the blog reader and the lesson reader.
 *
 * WHY A DOM ISLAND, NOT A `pre` OVERRIDE. The two surfaces render fenced code
 * differently on purpose: the lesson map styles `<pre>` inline (src/lib/courses/
 * mdx-components.tsx) while the blog has no component map at all and styles it from
 * `post.css`. What they DO share is the wrapper `rehype-pretty-code` puts around every
 * block — `<figure data-rehype-pretty-code-figure>` — which is also the one element
 * that stays put while the `<pre>` inside it scrolls. So instead of forking a `<pre>`
 * component two ways, this single client component mounts once inside each reader's
 * content container and portals a button into each figure it finds there. Neither
 * surface's existing code styling is touched.
 *
 * Runnable cells (`PyCell`) are NOT reached here — they are React editors, not
 * rehype-pretty-code figures, so they carry their own `CopyButton` (see PyCellClient).
 *
 * Progressive enhancement: the button exists only after hydration and is revealed on
 * hover (or always, on touch — see code-copy.css). A reader with JS off loses nothing
 * they had before; a reader with JS on gains a one-click copy. The highlighted code and
 * everything else are still server-rendered.
 *
 * Mount it as a DIRECT CHILD of the content container (`.post-content` / the lesson's
 * `.lesson-content`): it reads `parentElement` to scope its query, so the copy buttons
 * never leak onto a code sample that lives elsewhere on the page.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CopyButton } from "./CopyButton";
import { codeTextFromFigure } from "./code-text";

export default function CodeCopyButtons() {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [figures, setFigures] = useState<HTMLElement[]>([]);

  useEffect(() => {
    const container = anchorRef.current?.parentElement;
    if (!container) return;
    setFigures(
      Array.from(
        container.querySelectorAll<HTMLElement>("[data-rehype-pretty-code-figure]"),
      ),
    );
  }, []);

  return (
    <span ref={anchorRef} hidden>
      {figures.map((figure, i) =>
        createPortal(
          <CopyButton getText={() => codeTextFromFigure(figure)} />,
          figure,
          `code-copy-${i}`,
        ),
      )}
    </span>
  );
}
