/*
 * REFACTOR-R4-P2-02 — Icon-name extractor for the Material Symbols subset guard.
 *
 * The icon font is a SUBSET holding only the glyphs listed in `src/constants/icons.ts`.
 * A name missing from it renders as its ligature word ("calendar_month") in the icon's
 * box, so `pnpm check:icons` (`scripts/check-icons.ts`) compares what the source uses
 * with that list, and the list with the font's manifest. The logic lives here, pure, so
 * it can be unit tested on fixture strings; the script only reads files and reports.
 *
 * What counts as a use (parsed with the TypeScript compiler API, not regexes):
 *   1. text children of a JSX element whose `className` mentions
 *      `material-symbols-outlined`:  <span className="material-symbols-outlined">close</span>
 *   2. string literals inside those children's expressions, through ternaries,
 *      `||` / `??` / `&&` and parentheses:  {copied ? "check" : "share"}
 *   3. string values given to an `icon` or `glyph` JSX prop, object key, variable or
 *      destructuring default (again through ternaries):  icon="lock", { glyph: "mail" }
 *
 * The other expression children of an icon element must read one of those names —
 * `{icon}`, `{glyph}`, `{link.icon}` — so their values are the ones (3) collects.
 * Anything else (`{symbol}`, `{iconFor(status)}`) can't be followed statically and is
 * reported as `unresolved`: route it through an `icon`/`glyph` prop or variable.
 * A name BUILT at runtime (`${kind}_circle`) is invisible to all of this: add it to
 * `ICON_NAMES` by hand, and keep it as a literal somewhere so it isn't reported unused.
 *
 * Only strings shaped like a Material Symbols name (`[a-z0-9_]+`) count for (3), so an
 * emoji or a URL in some unrelated `icon` field is ignored. Text children of an icon
 * element are always reported, since any text there is rendered with the icon font.
 */

import ts from "typescript";

export const ICON_CLASS = "material-symbols-outlined";

/** The subset font `next/font/local` loads, and the manifest `pnpm build:icons` writes beside it. */
export const ICON_FONT_FILE = "src/app/[locale]/fonts/material-symbols-outlined.woff2";
export const ICON_MANIFEST_FILE = "src/app/[locale]/fonts/material-symbols-outlined.json";

export interface IconFontManifest {
  note: string;
  axes: string;
  /** sha256 of the woff2 as downloaded. */
  sha256: string;
  /** The sorted names the font was built from. */
  names: string[];
}

/** Prop / key / variable names whose string values are icon names. */
export const ICON_KEYS: readonly string[] = ["icon", "glyph"];

const NAME_RE = /^[a-z0-9_]+$/;
const CLASS_RE = new RegExp(`(^|[^\\w-])${ICON_CLASS}($|[^\\w-])`);

export type IconUseKind = "text" | "prop" | "key";

export interface IconUse {
  name: string;
  file: string;
  line: number;
  kind: IconUseKind;
}

export interface UnresolvedIconChild {
  file: string;
  line: number;
  expression: string;
}

export interface ExtractResult {
  uses: IconUse[];
  /** Expression children of an icon element that neither are literals nor read an ICON_KEYS name. */
  unresolved: UnresolvedIconChild[];
}

export function isIconName(value: string): boolean {
  return NAME_RE.test(value);
}

/**
 * Splits an expression into the string literals it can evaluate to (following
 * ternaries and logical operators) and the leaves it can't resolve.
 */
function literalLeaves(expr: ts.Expression): { values: string[]; opaque: ts.Expression[] } {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return { values: [expr.text], opaque: [] };
  }
  // `null` / `undefined` / booleans render nothing: resolved, no name.
  if (
    expr.kind === ts.SyntaxKind.NullKeyword ||
    expr.kind === ts.SyntaxKind.TrueKeyword ||
    expr.kind === ts.SyntaxKind.FalseKeyword ||
    (ts.isIdentifier(expr) && expr.text === "undefined")
  ) {
    return { values: [], opaque: [] };
  }
  if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr)) {
    return literalLeaves(expr.expression);
  }
  if (ts.isConditionalExpression(expr)) {
    const a = literalLeaves(expr.whenTrue);
    const b = literalLeaves(expr.whenFalse);
    return { values: [...a.values, ...b.values], opaque: [...a.opaque, ...b.opaque] };
  }
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
      // `cond && "name"`: the left side renders nothing when falsy.
      return literalLeaves(expr.right);
    }
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      const a = literalLeaves(expr.left);
      const b = literalLeaves(expr.right);
      return { values: [...a.values, ...b.values], opaque: [...a.opaque, ...b.opaque] };
    }
  }
  return { values: [], opaque: [expr] };
}

/** `icon` for `{icon}` / `{link.icon}` / `{link?.icon}`; null for calls and the rest. */
function readKey(expr: ts.Expression): string | null {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return null;
}

function attributeName(attr: ts.JsxAttribute): string {
  return ts.isIdentifier(attr.name) ? attr.name.text : attr.name.getText();
}

function hasIconClass(opening: ts.JsxOpeningLikeElement): boolean {
  for (const prop of opening.attributes.properties) {
    if (!ts.isJsxAttribute(prop) || attributeName(prop) !== "className") continue;
    const init = prop.initializer;
    if (!init) continue;
    // A plain string, or the source of `{cn("material-symbols-outlined", …)}` / a template.
    const classText = ts.isStringLiteral(init) ? init.text : init.getText();
    if (CLASS_RE.test(classText)) return true;
  }
  return false;
}

function propertyNameText(name: ts.PropertyName | ts.BindingName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

export function extractIcons(source: string, file: string): ExtractResult {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const uses: IconUse[] = [];
  const unresolved: UnresolvedIconChild[] = [];
  const lineAt = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const lineOf = (node: ts.Node) => lineAt(node.getStart(sf));
  const isIconKey = (name: string | null) => name !== null && ICON_KEYS.includes(name);

  const addValues = (expr: ts.Expression, kind: IconUseKind, at: ts.Node) => {
    for (const value of literalLeaves(expr).values) {
      if (isIconName(value)) uses.push({ name: value, file, line: lineOf(at), kind });
    }
  };

  const visit = (node: ts.Node) => {
    // (1) + (2): children of an element carrying the icon class.
    if (ts.isJsxElement(node) && hasIconClass(node.openingElement)) {
      for (const child of node.children) {
        if (ts.isJsxText(child)) {
          const text = child.text.trim();
          // JSX text starts right after the opening tag; point at the word, not the tag.
          const at = child.getStart(sf) + child.text.length - child.text.trimStart().length;
          if (text) uses.push({ name: text, file, line: lineAt(at), kind: "text" });
        } else if (ts.isJsxExpression(child) && child.expression) {
          const { values, opaque } = literalLeaves(child.expression);
          for (const value of values) {
            uses.push({ name: value, file, line: lineOf(child), kind: "text" });
          }
          for (const leaf of opaque) {
            if (!isIconKey(readKey(leaf))) {
              unresolved.push({ file, line: lineOf(leaf), expression: leaf.getText(sf) });
            }
          }
        }
      }
    }

    // (3) `icon="…"` / `glyph={…}` JSX props.
    if (ts.isJsxAttribute(node) && isIconKey(attributeName(node)) && node.initializer) {
      const init = node.initializer;
      if (ts.isStringLiteral(init)) addValues(init, "prop", node);
      else if (ts.isJsxExpression(init) && init.expression) addValues(init.expression, "prop", node);
    }

    // (3) `icon: "…"` object keys.
    if (ts.isPropertyAssignment(node) && isIconKey(propertyNameText(node.name))) {
      addValues(node.initializer, "key", node);
    }

    // (3) `{ icon = "…" }` destructuring defaults and `const icon = …` declarations.
    if ((ts.isBindingElement(node) || ts.isVariableDeclaration(node)) && node.initializer) {
      const key = ts.isBindingElement(node) ? node.propertyName ?? node.name : node.name;
      if (isIconKey(propertyNameText(key))) addValues(node.initializer, "prop", node);
    }

    ts.forEachChild(node, visit);
  };

  visit(sf);
  return { uses, unresolved };
}

/** Every string literal in a file (for the "unused" check). */
export function collectStringLiterals(source: string, file: string, into: Set<string>): void {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) into.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

export interface IconCheck {
  /** Uses whose name is not in the subset list (they would render as text). */
  unknown: IconUse[];
  /** Subset entries named nowhere in the source (they only bloat the font). */
  unused: string[];
  /** Subset entries that are unsorted, duplicated, or not icon-shaped. */
  listErrors: string[];
}

/**
 * `referencedLiterals` holds every string literal in the scanned source. An
 * `ICON_NAMES` entry counts as used when a detected use names it OR it appears as a
 * literal somewhere else (a hand-added runtime name kept in a lookup table), so only
 * names that appear nowhere at all are reported as unused.
 */
export function checkIcons(
  uses: readonly IconUse[],
  iconNames: readonly string[],
  referencedLiterals: ReadonlySet<string>,
): IconCheck {
  const known = new Set(iconNames);
  const used = new Set(uses.map((u) => u.name));

  const listErrors: string[] = [];
  const seen = new Set<string>();
  iconNames.forEach((name, i) => {
    if (!isIconName(name)) listErrors.push(`"${name}" is not a Material Symbols name`);
    if (seen.has(name)) listErrors.push(`"${name}" is listed twice`);
    seen.add(name);
    const prev = iconNames[i - 1];
    if (prev !== undefined && prev > name) listErrors.push(`"${name}" is out of order (after "${prev}")`);
  });

  return {
    unknown: uses.filter((u) => !known.has(u.name)),
    unused: iconNames.filter((name) => !used.has(name) && !referencedLiterals.has(name)),
    listErrors,
  };
}

/**
 * The committed font must be the one `pnpm build:icons` produced for the current list:
 * editing `ICON_NAMES` without rebuilding (or swapping the woff2 by hand) would ship a
 * font that lacks the new glyphs.
 */
export function checkFontManifest(
  manifest: Pick<IconFontManifest, "names" | "sha256">,
  iconNames: readonly string[],
  fontSha256: string,
): string[] {
  const errors: string[] = [];
  const built = new Set(manifest.names);
  const listed = new Set(iconNames);
  const missing = iconNames.filter((n) => !built.has(n));
  const extra = manifest.names.filter((n) => !listed.has(n));
  if (missing.length > 0) errors.push(`not in the built font: ${missing.join(", ")}`);
  if (extra.length > 0) errors.push(`in the built font but no longer listed: ${extra.join(", ")}`);
  if (manifest.sha256 !== fontSha256) errors.push("the woff2 does not match the manifest's sha256");
  return errors;
}
