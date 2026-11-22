/*
 * BLOG-27 — the MDX-facing entry point for an interactive figure in a post.
 *
 * A post writes `<PostFigure id="latency-budget" caption="…" />`. This resolves the id against
 * the blog's own figure registry and renders it inside a frame that reserves its height before
 * hydration (the figure is `ssr: false`, so the server HTML holds only the frame and the
 * caption), behind an error boundary so a broken figure never blanks the post.
 *
 * It mirrors the lesson reader's `Explorable`, deliberately without importing it: the courses'
 * widget tree is forbidden off the lesson route by `check:bundle`. An unknown id fails
 * `lint:content`, so in production it renders nothing; in dev it says which file to edit.
 *
 * The caption is authored per post, so it arrives in the post's language. The figure's own
 * text lives under `blog.figures.*` in both message files.
 */

"use client";

import { useTranslations } from "next-intl";
import { Component, Suspense, type ErrorInfo, type ReactNode } from "react";

import { isPostFigureId } from "./figure-ids";
import { POST_FIGURES } from "./registry";

export interface PostFigureProps {
  id: string;
  caption?: string;
  /** Reserved height in px while the figure loads (default 560). */
  height?: number;
}

export function PostFigure({ id, caption, height = 560 }: PostFigureProps) {
  const t = useTranslations("blog.figures.common");

  if (!isPostFigureId(id)) {
    if (process.env.NODE_ENV !== "production") {
      return (
        <div role="alert" style={{ color: "var(--error)", fontSize: "0.9rem", margin: "2rem 0" }}>
          No post figure registered for id <code>{id}</code>. Add it to{" "}
          <code>src/features/blog/figures/figure-ids.ts</code> + <code>registry.ts</code>.
        </div>
      );
    }
    return null;
  }

  const Figure = POST_FIGURES[id];

  return (
    <div className="post-figure" role="group" aria-label={caption}>
      <div className="post-figure__body" style={{ minHeight: height }}>
        <FigureErrorBoundary id={id} message={t("error")}>
          <Suspense fallback={<div aria-hidden className="post-figure__skeleton" style={{ minHeight: height }} />}>
            <Figure />
          </Suspense>
        </FigureErrorBoundary>
      </div>
      {caption && <p className="post-figure__caption">{caption}</p>}
    </div>
  );
}

interface BoundaryProps {
  id: string;
  message: string;
  children: ReactNode;
}

class FigureErrorBoundary extends Component<BoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Same call as the lesson reader's boundary: there is no app logger in the client
    // figure layer, and the browser console is where a render failure is looked for.
    console.error(`PostFigure "${this.props.id}" crashed`, error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div role="alert" className="post-figure__error">
          {this.props.message}
        </div>
      );
    }
    return this.props.children;
  }
}

export default PostFigure;
