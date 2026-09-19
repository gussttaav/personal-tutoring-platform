/*
 * REDESIGN-P2-02 — tests for `pickTestimonials`'s ordering: the visitor's own language first,
 * top three, stable otherwise.
 */

import { pickTestimonials, TESTIMONIALS } from "@/constants/testimonials";

describe("pickTestimonials", () => {
  it("returns the three Spanish quotes, in list order, for locale es", () => {
    expect(pickTestimonials("es").map((t) => t.name)).toEqual([
      "Sergi Pérez",
      "Alberto González",
      "Pablo",
    ]);
  });

  it("puts the English quote first for locale en, then the next two in list order", () => {
    expect(pickTestimonials("en").map((t) => t.name)).toEqual([
      "Jeremy GL",
      "Sergi Pérez",
      "Alberto González",
    ]);
  });

  it("always returns exactly three", () => {
    expect(pickTestimonials("es")).toHaveLength(3);
    expect(pickTestimonials("en")).toHaveLength(3);
  });

  it("does not mutate TESTIMONIALS", () => {
    const before = TESTIMONIALS.map((t) => t.name);
    pickTestimonials("en");
    expect(TESTIMONIALS.map((t) => t.name)).toEqual(before);
  });
});
