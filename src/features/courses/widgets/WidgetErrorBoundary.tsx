/*
 * COURSE-P2-01 — Error boundary so one broken widget never blanks the lesson.
 *
 * React error boundaries must be class components (no hook equivalent). A widget
 * that throws during render is caught here and replaced with a small, contained
 * message styled from the error design tokens — the surrounding prose is untouched.
 */

"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Widget id, surfaced in the fallback so a failure is traceable in a lesson. */
  widgetId: string;
}

interface State {
  hasError: boolean;
}

export class WidgetErrorBoundary extends Component<Props, State> {
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
          <span>
            This interactive widget (<code>{this.props.widgetId}</code>) failed to load.
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}
