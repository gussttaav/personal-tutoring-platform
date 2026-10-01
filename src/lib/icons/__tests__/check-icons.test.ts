/*
 * REFACTOR-R4-P2-02 — Icon subset guard: extractor + checks.
 */

import { ICON_NAMES } from "@/constants/icons";

import { checkFontManifest, checkIcons, collectStringLiterals, extractIcons } from "../check-icons";

const FIXTURE = `
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/blog", label: "Blog", icon: "edit_note" },
];

const rows = [{ glyph: "mail", label: "Email" }];

function Row({ glyph }: { glyph: string }) {
  return <span className="material-symbols-outlined">{glyph}</span>;
}

function Arrow({ icon = "arrow_forward" }: { icon?: string }) {
  return <span className={\`material-symbols-outlined \${"x"}\`}>{icon}</span>;
}

export function Fixture({ copied, open, admin }: { copied: boolean; open: boolean; admin: boolean }) {
  const [x] = useState(0);
  return (
    <div className="card">
      <span className="material-symbols-outlined text-lg" aria-hidden="true">
        calendar_month
      </span>
      <span className="material-symbols-outlined">{copied ? "check" : "share"}</span>
      <span className={cn("material-symbols-outlined", open && "rotate")}>{open && "expand_more"}</span>
      <i className="material-symbols-outlined">{(admin ? "admin_panel_settings" : null) ?? "dashboard"}</i>
      <span className="material-symbols-outlined-extra">not_an_icon_element</span>
      <p className="note">plain text, not an icon</p>
      <Button icon="lock" label="Pay" />
      <Button icon={open ? "close" : "menu"} />
      <Button icon="🚀" />
      <MiniIcon glyph="tag" />
      {LINKS.map((l) => <span key={l.href} className="material-symbols-outlined">{l.icon}</span>)}
      {rows.map((r) => <span key={r.label} className="material-symbols-outlined">{r.glyph}</span>)}
      <span className="material-symbols-outlined">{symbol}</span>
      <span className="material-symbols-outlined">{iconFor(x)}</span>
      <span className="material-symbols-outlined">{/* a comment */}</span>
    </div>
  );
}
`;

function namesOf(kind?: string) {
  const { uses } = extractIcons(FIXTURE, "Fixture.tsx");
  return uses.filter((u) => !kind || u.kind === kind).map((u) => u.name);
}

describe("extractIcons", () => {
  it("reads the text child of an icon element, with its line", () => {
    const { uses } = extractIcons(FIXTURE, "Fixture.tsx");
    const use = uses.find((u) => u.name === "calendar_month");
    // The word's own line, not the opening tag's (the line before it).
    const line = FIXTURE.split("\n").findIndex((l) => l.trim() === "calendar_month") + 1;
    expect(use).toEqual({ name: "calendar_month", file: "Fixture.tsx", line, kind: "text" });
  });

  it("follows ternaries, && and ?? inside an icon element's children", () => {
    expect(namesOf("text")).toEqual(
      expect.arrayContaining(["check", "share", "expand_more", "admin_panel_settings", "dashboard"]),
    );
  });

  it("recognises the icon class inside a template literal or a cn() call", () => {
    // `expand_more` sits in a cn(...) className; `{icon}` in Arrow sits in a template one
    // and would otherwise show up as unresolved.
    expect(namesOf("text")).toContain("expand_more");
    const { unresolved } = extractIcons(FIXTURE, "Fixture.tsx");
    expect(unresolved.map((u) => u.expression)).not.toContain("icon");
  });

  it("does not match a class that only starts with the icon class name, nor plain text", () => {
    expect(namesOf()).not.toContain("not_an_icon_element");
    expect(namesOf()).not.toContain("plain text, not an icon");
  });

  it("reads string values of icon/glyph props, including through a ternary", () => {
    expect(namesOf("prop")).toEqual(expect.arrayContaining(["lock", "close", "menu", "tag"]));
  });

  it("reads icon/glyph object keys", () => {
    expect(namesOf("key")).toEqual(expect.arrayContaining(["home", "edit_note", "mail"]));
  });

  it("reads icon destructuring defaults", () => {
    expect(namesOf("prop")).toContain("arrow_forward");
  });

  it("ignores icon values that aren't shaped like a Material Symbols name", () => {
    expect(namesOf()).not.toContain("🚀");
  });

  it("accepts {icon} / {glyph} / {x.icon} children and reports every other expression", () => {
    const { unresolved } = extractIcons(FIXTURE, "Fixture.tsx");
    expect(unresolved.map((u) => u.expression)).toEqual(["symbol", "iconFor(x)"]);
  });

  it("finds nothing in a file without icons", () => {
    expect(extractIcons(`export const x = <p className="note">hello</p>;`, "a.tsx")).toEqual({
      uses: [],
      unresolved: [],
    });
  });
});

describe("checkIcons", () => {
  const use = (name: string) => ({ name, file: "a.tsx", line: 1, kind: "text" as const });

  it("reports a used name missing from the list", () => {
    const check = checkIcons([use("home"), use("rocket_launch")], ["home"], new Set());
    expect(check.unknown.map((u) => u.name)).toEqual(["rocket_launch"]);
  });

  it("reports a listed name used nowhere, unless it appears as a literal somewhere", () => {
    const check = checkIcons([use("home")], ["home", "star", "stale"], new Set(["star"]));
    expect(check.unused).toEqual(["stale"]);
  });

  it("reports an unsorted, duplicated or malformed list", () => {
    const check = checkIcons([], ["menu", "home", "home", "Bad Name"], new Set(["menu", "home", "Bad Name"]));
    expect(check.listErrors).toEqual([
      `"home" is out of order (after "menu")`,
      `"home" is listed twice`,
      `"Bad Name" is not a Material Symbols name`,
      `"Bad Name" is out of order (after "home")`,
    ]);
  });

  it("passes the real ICON_NAMES list (sorted, unique, icon-shaped)", () => {
    const literals = new Set<string>(ICON_NAMES);
    expect(checkIcons([], ICON_NAMES, literals).listErrors).toEqual([]);
  });
});

describe("checkFontManifest", () => {
  it("passes when the font was built from the current list", () => {
    expect(checkFontManifest({ names: ["home", "menu"], sha256: "abc" }, ["home", "menu"], "abc")).toEqual([]);
  });

  it("fails when the list gained or lost a name, or the woff2 changed", () => {
    expect(checkFontManifest({ names: ["home", "old"], sha256: "abc" }, ["home", "new"], "def")).toEqual([
      "not in the built font: new",
      "in the built font but no longer listed: old",
      "the woff2 does not match the manifest's sha256",
    ]);
  });
});

describe("collectStringLiterals", () => {
  it("collects string and no-substitution template literals", () => {
    const into = new Set<string>();
    collectStringLiterals("const a = { ok: 'task_alt', b: `link_off` }; f(\"x\");", "a.ts", into);
    expect([...into].sort()).toEqual(["link_off", "task_alt", "x"]);
  });
});
