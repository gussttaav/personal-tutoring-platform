/*
 * REDESIGN-P3-01 — Message-key parity check.
 *
 * `messages/es.json` and `messages/en.json` must share the same key tree: a key present
 * in only one file fails silently at runtime for that locale (next-intl just renders
 * nothing). This module is the pure diffing logic behind `scripts/check-messages.ts`;
 * kept here (rather than in the script) so it can be unit tested without touching the
 * filesystem.
 */

type LeafType = "string" | "array" | "object" | "number" | "boolean";

export interface MessageDiff {
  onlyInEs: string[];
  onlyInEn: string[];
  typeMismatches: { path: string; esType: LeafType; enType: LeafType }[];
  placeholderWarnings: { path: string; es: string[]; en: string[] }[];
}

// Arrays count as one leaf (e.g. `landing.hero.skills`) — never recurse into their
// elements. Plain objects recurse, and are also recorded at their own path so a leaf in
// one file lining up with a still-nested object in the other shows as a type mismatch
// rather than silently disappearing.
function flatten(node: unknown, prefix: string, out: Map<string, LeafType>): void {
  if (Array.isArray(node)) {
    out.set(prefix, "array");
    return;
  }
  if (node !== null && typeof node === "object") {
    out.set(prefix, "object");
    for (const [key, value] of Object.entries(node)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, out);
    }
    return;
  }
  out.set(prefix, typeof node as LeafType);
}

export function flattenMessageTree(tree: Record<string, unknown>): Map<string, LeafType> {
  const out = new Map<string, LeafType>();
  for (const [key, value] of Object.entries(tree)) {
    flatten(value, key, out);
  }
  return out;
}

// A minimal, non-validating ICU placeholder scan: capture the identifier that opens a
// brace pair ONLY at nesting depth 0. `{count}` and `{klass, select, ...}` are depth-0 and
// captured as `count` / `klass`; the literal branch bodies of a plural/select
// (`positive {positiva}`, `one {# clase}`) sit one level deeper and are skipped, so a
// translated select option keyword doesn't masquerade as a missing placeholder. This
// deliberately does not parse ICU grammar — see the module comment in the script.
export function extractPlaceholders(message: string): Set<string> {
  const placeholders = new Set<string>();
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    const ch = message[i];
    if (ch === "{") {
      if (depth === 0) {
        const match = /^\{\s*(\w+)/.exec(message.slice(i));
        if (match) placeholders.add(match[1]);
      }
      depth++;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
    }
  }
  return placeholders;
}

export function diffMessages(
  es: Record<string, unknown>,
  en: Record<string, unknown>,
): MessageDiff {
  const esFlat = flattenMessageTree(es);
  const enFlat = flattenMessageTree(en);

  const onlyInEs = [...esFlat.keys()].filter((path) => !enFlat.has(path)).sort();
  const onlyInEn = [...enFlat.keys()].filter((path) => !esFlat.has(path)).sort();

  const typeMismatches: MessageDiff["typeMismatches"] = [];
  const placeholderWarnings: MessageDiff["placeholderWarnings"] = [];

  for (const [path, esType] of esFlat) {
    const enType = enFlat.get(path);
    if (enType === undefined || enType === esType) continue;
    typeMismatches.push({ path, esType, enType });
  }

  for (const [path, esType] of esFlat) {
    if (esType !== "string" || enFlat.get(path) !== "string") continue;
    const esValue = getPath(es, path) as string;
    const enValue = getPath(en, path) as string;
    const esPlaceholders = extractPlaceholders(esValue);
    const enPlaceholders = extractPlaceholders(enValue);
    const onlyEs = [...esPlaceholders].filter((p) => !enPlaceholders.has(p));
    const onlyEn = [...enPlaceholders].filter((p) => !esPlaceholders.has(p));
    if (onlyEs.length > 0 || onlyEn.length > 0) {
      placeholderWarnings.push({ path, es: onlyEs, en: onlyEn });
    }
  }

  return {
    onlyInEs,
    onlyInEn,
    typeMismatches: typeMismatches.sort((a, b) => a.path.localeCompare(b.path)),
    placeholderWarnings: placeholderWarnings.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

function getPath(tree: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => {
    if (node !== null && typeof node === "object") {
      return (node as Record<string, unknown>)[key];
    }
    return undefined;
  }, tree);
}

export function hasErrors(diff: MessageDiff): boolean {
  return diff.onlyInEs.length > 0 || diff.onlyInEn.length > 0 || diff.typeMismatches.length > 0;
}
