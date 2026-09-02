/*
 * COURSE-P2-01 — Error boundary so one broken widget never blanks the lesson.
 *
 * React error boundaries must be class components (no hook equivalent). A widget
 * that throws during render is caught here and replaced with a small, contained
 * message styled from the error design tokens — the surrounding prose is untouched.
 *
 * COURSE-P11-02 — the fallback sentence was hardcoded English, which a Spanish reader
 * would have seen too. It is now `courses.widgets.common.error`, translated in both
 * locales. A class component cannot call `useTranslations`, so the message arrives as
 * a render prop from the function wrapper below — which is what `Explorable` renders.
 */

"use client";

import { useTranslations } from "next-intl";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Widget id, surfaced in the fallback so a failure is traceable in a lesson. */
  widgetId: string;
  /** Already-translated fallback sentence; supplied by `WidgetErrorBoundary`. */
  message: string;
}

interface State {
  hasError: boolean;
}

class WidgetErrorBoundaryInner extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No app logger in the client widget layer; the browser console is the right
    // place for a widget render failure during authoring/dev.
    console.error(`Explorable "${this.props.widgetId}" crashed`, error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: "0.6rem",
            padding: "1rem 1.25rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--error)",
            background: "var(--error-bg)",
            color: "var(--text-muted)",
            fontSize: "0.9rem",
          }}
        >
          <span aria-hidden>⚠️</span>
          <span>{this.props.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

export function WidgetErrorBoundary({ children, widgetId }: Omit<Props, "message">) {
  const t = useTranslations("courses.widgets.common");
  return (
    <WidgetErrorBoundaryInner widgetId={widgetId} message={t("error", { id: widgetId })}>
      {children}
    </WidgetErrorBoundaryInner>
  );
}
