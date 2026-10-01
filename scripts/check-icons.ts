/*
 * REFACTOR-R4-P2-02 — Icon subset guard (`pnpm check:icons`, runs in CI).
 *
 * The Material Symbols font is a SUBSET built from `ICON_NAMES` (`src/constants/icons.ts`)
 * by `pnpm build:icons`. A name missing from it renders as its ligature word
 * ("calendar_month") inside the icon's box, and nothing else would notice. This fails when:
 *   - an icon name used in `src/` is not in `ICON_NAMES`,
 *   - an icon element's child can't be followed statically (not a literal, not `{icon}` /
 *     `{glyph}` / `{x.icon}`: route it through an `icon`/`glyph` prop or variable),
 *   - an `ICON_NAMES` entry appears nowhere in `src/` (stale entries bloat the subset),
 *   - the list is unsorted or has duplicates (Google's `icon_names` wants it sorted),
 *   - the committed woff2 was not built from the current list (manifest mismatch).
 *
 * What it detects is documented in `src/lib/icons/check-icons.ts`. It CAN'T see a name
 * built at runtime (`${kind}_circle`, a value read from data): add such a name to
 * `ICON_NAMES` by hand, and keep it as a string literal somewhere in `src/` so it isn't
 * reported as unused.
 *
 * Test files are skipped (fixtures hold deliberately unknown names). Uses `console`
 * deliberately, same as `check-messages.ts`: plain CLI, not app code.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ICON_NAMES } from "@/constants/icons";
import {
  ICON_FONT_FILE,
  ICON_MANIFEST_FILE,
  checkFontManifest,
  checkIcons,
  collectStringLiterals,
  extractIcons,
  type IconFontManifest,
  type IconUse,
  type UnresolvedIconChild,
} from "@/lib/icons/check-icons";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const ICON_LIST_FILE = path.join("src", "constants", "icons.ts");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__" && entry.name !== "node_modules") sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

const uses: IconUse[] = [];
const unresolved: UnresolvedIconChild[] = [];
const literals = new Set<string>();

for (const file of sourceFiles(SRC)) {
  const rel = path.relative(ROOT, file);
  if (rel === ICON_LIST_FILE) continue; // its own literals would mark every entry as used
  const source = fs.readFileSync(file, "utf8");
  const result = extractIcons(source, rel);
  uses.push(...result.uses);
  unresolved.push(...result.unresolved);
  collectStringLiterals(source, rel, literals);
}

const check = checkIcons(uses, ICON_NAMES, literals);

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, ICON_MANIFEST_FILE), "utf8")) as IconFontManifest;
const fontSha = createHash("sha256").update(fs.readFileSync(path.join(ROOT, ICON_FONT_FILE))).digest("hex");
const fontErrors = checkFontManifest(manifest, ICON_NAMES, fontSha);

for (const u of check.unknown) {
  console.error(`✗ ${u.file}:${u.line}: "${u.name}" is not in ICON_NAMES (would render as text)`);
}
for (const u of unresolved) {
  console.error(
    `✗ ${u.file}:${u.line}: icon child {${u.expression}} can't be checked; pass it through an \`icon\`/\`glyph\` prop or variable`,
  );
}
for (const name of check.unused) {
  console.error(`✗ ${ICON_LIST_FILE}: "${name}" is used nowhere in src/ (remove it, then \`pnpm build:icons\`)`);
}
for (const msg of check.listErrors) {
  console.error(`✗ ${ICON_LIST_FILE}: ${msg}`);
}
for (const msg of fontErrors) {
  console.error(`✗ ${ICON_FONT_FILE}: ${msg} (run \`pnpm build:icons\`)`);
}

const failures =
  check.unknown.length + unresolved.length + check.unused.length + check.listErrors.length + fontErrors.length;
if (failures > 0) {
  console.error(`\n✗ check:icons failed: ${failures} issue(s)`);
  process.exit(1);
}

console.log(`✓ check:icons passed (${ICON_NAMES.length} icons, ${uses.length} uses)`);
