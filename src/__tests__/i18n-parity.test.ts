// COURSE-P6-02b — messages/es.json and messages/en.json must stay key-for-key in sync.
//
// Nothing enforced this before. next-intl resolves a missing key at render time, per locale,
// so a key added to only one file is invisible until a visitor in the other language hits
// that exact string — and for the email templates, "hits that string" means an already-sent
// email. This is the cheapest possible guard: two sets, one comparison.

import es from "../../messages/es.json";
import en from "../../messages/en.json";

type Tree = { [key: string]: unknown };

/** Every leaf path in the tree, e.g. "emails.courseUpdate.subject". */
function leafPaths(node: unknown, prefix = ""): string[] {
  if (node === null || typeof node !== "object" || Array.isArray(node)) return [prefix];
  return Object.entries(node as Tree).flatMap(([key, value]) =>
    leafPaths(value, prefix ? `${prefix}.${key}` : key),
  );
}

describe("message files", () => {
  const esKeys = new Set(leafPaths(es));
  const enKeys = new Set(leafPaths(en));

  it("has no key that exists only in Spanish", () => {
    expect([...esKeys].filter((k) => !enKeys.has(k)).sort()).toEqual([]);
  });

  it("has no key that exists only in English", () => {
    expect([...enKeys].filter((k) => !esKeys.has(k)).sort()).toEqual([]);
  });

  // A key present in both but empty in one is the same failure wearing a disguise.
  it.each(["es", "en"] as const)("has no blank value in %s", (locale) => {
    const tree = locale === "es" ? es : en;
    const blanks = leafPaths(tree).filter((path) => {
      const value = path.split(".").reduce<unknown>(
        (node, part) => (node as Tree | undefined)?.[part], tree,
      );
      return typeof value === "string" && value.trim() === "";
    });
    expect(blanks).toEqual([]);
  });
});
