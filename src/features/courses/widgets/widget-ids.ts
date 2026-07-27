/*
 * COURSE-P2-01 — The set of valid `<Explorable id="…">` ids.
 *
 * This module is PURE DATA with zero imports on purpose: the content linter
 * (`scripts/lint-content.ts`, run under Node/tsx) validates every `<Explorable id>`
 * in the MDX against `WIDGET_IDS` and must NOT drag in `next/dynamic` or any client
 * `.tsx`. So the id list lives here, and `registry.ts` maps these ids to lazily
 * loaded components — typed `Record<WidgetId, …>`, which makes a missing or unknown
 * registry key a compile error just as `keyof typeof WIDGETS` would.
 *
 * Adding a widget = add its id here, then add its entry in `registry.ts`.
 */

export const WIDGET_IDS = ["sigmoid-explorer"] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export function isWidgetId(id: string): id is WidgetId {
  return (WIDGET_IDS as readonly string[]).includes(id);
}
