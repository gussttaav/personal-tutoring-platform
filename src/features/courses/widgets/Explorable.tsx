/*
 * COURSE-P2-01 — MDX-facing entry point for interactive widgets.
 *
 * Authors write `<Explorable id="sigmoid-explorer" caption="…" />` in a lesson. This
 * resolves the id against the registry and renders the widget behind:
 *   WidgetFrame (reserves height → no layout shift)
 *     → WidgetErrorBoundary (a throw stays contained)
 *       → <Suspense> (the widget is `ssr:false` next/dynamic, so it streams in on hydrate)
 *
 * It is a Client Component because the registry uses `dynamic(..., { ssr: false })`,
 * which is illegal in a Server Component. It is still referenced from the SERVER MDX
 * component map (mdx-components.tsx); Next renders its frame/skeleton into the static
 * HTML and hydrates the widget on the client — so it only ever ships on the lesson route.
 *
 * An unknown id can't reach production: `scripts/lint-content.ts` fails the build on it.
 * In dev we still render a visible marker to make an authoring typo obvious.
 */

"use client";

import { Suspense } from "react";

import { WIDGETS } from "./registry";
import { isWidgetId } from "./widget-ids";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";
import { WidgetFrame } from "./primitives/WidgetFrame";

export interface ExplorableProps {
  id: string;
  /** Optional caption forwarded to the frame. */
  caption?: string;
  /** Any remaining props are forwarded to the resolved widget. */
  [key: string]: unknown;
}

export function Explorable({ id, caption, ...widgetProps }: ExplorableProps) {
  if (!isWidgetId(id)) {
    // lint:content guarantees this never happens in a real build; the marker only
    // appears while authoring locally with an unregistered id.
    if (process.env.NODE_ENV !== "production") {
      return (
        <WidgetFrame height={120} title="Unknown widget">
          <span style={{ color: "var(--error)", fontSize: "0.9rem" }}>
            No widget registered for id <code>{id}</code>. Add it to{" "}
            <code>widget-ids.ts</code> + <code>registry.ts</code>.
          </span>
        </WidgetFrame>
      );
    }
    return null;
  }

  const Widget = WIDGETS[id];

  return (
    <WidgetFrame caption={caption}>
      <WidgetErrorBoundary widgetId={id}>
        <Suspense fallback={<WidgetSkeleton />}>
          <Widget {...widgetProps} />
        </Suspense>
      </WidgetErrorBoundary>
    </WidgetFrame>
  );
}

function WidgetSkeleton() {
  return (
    <div
      aria-hidden
      style={{
        width: "100%",
        height: "100%",
        minHeight: 240,
        borderRadius: "var(--radius)",
        background:
          "linear-gradient(90deg, var(--surface-lowest) 0%, var(--surface-low) 50%, var(--surface-lowest) 100%)",
        opacity: 0.6,
      }}
    />
  );
}

export default Explorable;
