/*
 * REDESIGN-P3-01 — Message-key parity check.
 */

import { diffMessages, extractPlaceholders, hasErrors } from "../check-messages";

describe("diffMessages", () => {
  it("passes on identical trees", () => {
    const es = { common: { close: "Cerrar" }, nav: { home: "Inicio" } };
    const en = { common: { close: "Close" }, nav: { home: "Home" } };
    const diff = diffMessages(es, en);
    expect(diff.onlyInEs).toEqual([]);
    expect(diff.onlyInEn).toEqual([]);
    expect(diff.typeMismatches).toEqual([]);
    expect(hasErrors(diff)).toBe(false);
  });

  it("fails naming a key missing from the other file", () => {
    const es = { common: { close: "Cerrar", extra: "Sobra" } };
    const en = { common: { close: "Close" } };
    const diff = diffMessages(es, en);
    expect(diff.onlyInEs).toEqual(["common.extra"]);
    expect(diff.onlyInEn).toEqual([]);
    expect(hasErrors(diff)).toBe(true);
  });

  it("fails naming a key present only in en", () => {
    const es = { common: { close: "Cerrar" } };
    const en = { common: { close: "Close", extra: "Extra" } };
    const diff = diffMessages(es, en);
    expect(diff.onlyInEn).toEqual(["common.extra"]);
    expect(hasErrors(diff)).toBe(true);
  });

  it("fails naming the key and both types on a type mismatch", () => {
    const es = { landing: { hero: { skills: ["a", "b"] } } };
    const en = { landing: { hero: { skills: "a, b" } } };
    const diff = diffMessages(es, en);
    expect(diff.typeMismatches).toEqual([
      { path: "landing.hero.skills", esType: "array", enType: "string" },
    ]);
    expect(hasErrors(diff)).toBe(true);
  });

  it("treats arrays as a single leaf, not recursed into", () => {
    const es = { landing: { hero: { skills: ["a", "b", "c"] } } };
    const en = { landing: { hero: { skills: ["x", "y"] } } };
    const diff = diffMessages(es, en);
    expect(diff.onlyInEs).toEqual([]);
    expect(diff.onlyInEn).toEqual([]);
    expect(diff.typeMismatches).toEqual([]);
  });

  it("warns without failing when an ICU placeholder differs between locales", () => {
    const es = { nav: { classesAvailable: "{count} clases disponibles" } };
    const en = { nav: { classesAvailable: "some classes available" } };
    const diff = diffMessages(es, en);
    expect(diff.onlyInEs).toEqual([]);
    expect(diff.onlyInEn).toEqual([]);
    expect(diff.typeMismatches).toEqual([]);
    expect(diff.placeholderWarnings).toEqual([
      { path: "nav.classesAvailable", es: ["count"], en: [] },
    ]);
    expect(hasErrors(diff)).toBe(false);
  });
});

describe("extractPlaceholders", () => {
  it("captures a simple placeholder", () => {
    expect(extractPlaceholders("{count} clases")).toEqual(new Set(["count"]));
  });

  it("captures the leading argument of a plural/select construct", () => {
    const message = "clase {klass, select, positive {positiva} other {negativa}}";
    expect(extractPlaceholders(message)).toEqual(new Set(["klass"]));
  });

  it("does not treat a translated select branch keyword as a placeholder", () => {
    const es = "{klass, select, positive {positiva} other {negativa}}";
    const en = "{klass, select, positive {positive} other {negative}}";
    expect(extractPlaceholders(es)).toEqual(extractPlaceholders(en));
  });

  it("returns an empty set for plain text", () => {
    expect(extractPlaceholders("Cerrar sesión")).toEqual(new Set());
  });
});
