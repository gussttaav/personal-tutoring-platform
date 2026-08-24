// COURSE-P2-01 — Registry integrity: the WIDGETS map covers exactly the id list.
//
// The `Record<WidgetId, …>` type already enforces this at compile time; this test
// documents it at runtime and guards against a future `as any` cast quietly leaving
// an id unregistered (which would render nothing / a dev-only marker in a lesson).

import { WIDGETS } from "@/features/courses/widgets/registry";
import { WIDGET_IDS } from "@/features/courses/widgets/widget-ids";

describe("widget registry", () => {
  it("has an entry for every declared id and no extras", () => {
    expect(Object.keys(WIDGETS).sort()).toEqual([...WIDGET_IDS].sort());
  });

  it("resolves each id to a component", () => {
    for (const id of WIDGET_IDS) {
      expect(WIDGETS[id]).toBeDefined();
    }
  });
});
