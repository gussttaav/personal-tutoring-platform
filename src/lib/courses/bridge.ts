/*
 * COURSE-P7-01 — The bridge pre-pass.
 *
 * A `<Leccion>` renders as plain text when it points AHEAD from inside the bridge,
 * because `LessonNav` already links that exact lesson two paragraphs below it. But a
 * Server Component cannot know its own position in the document — it receives props,
 * not a place — so the position has to be decided on the SOURCE, before `compileMDX`
 * ever sees it: every `<Leccion` below the lone `---` gets a `bridge` attribute.
 *
 * A remark plugin would be the "proper" alternative. It would also add a plugin to the
 * chain whose ORDER `mdx.test.ts` guards (rehype-slug before rehype-katex, and so on),
 * and the phase README rules that out on purpose. This touches nothing in the pipeline:
 * a string goes in, a string comes out.
 *
 * Two things the naive version gets wrong, both silent:
 *
 *   - The source still carries its FRONTMATTER here. `renderLesson` is handed the raw
 *     file and `parseFrontmatter: true` strips it inside the compiler, so "the last
 *     `---` in the string" is the frontmatter's own closing delimiter in any lesson
 *     that has no bridge — which would flag the entire body as bridge.
 *   - A `---` inside a fenced block is not a thematic break, and a `<Leccion` inside a
 *     fenced block below the bridge is a code sample the reader is meant to see
 *     verbatim, not a tag to rewrite.
 *
 * Both are asserted in bridge.test.ts.
 */

/** The frontmatter block, whose `---` delimiters are not the bridge. */
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;

/*
 * The dash form of `validate-structure.ts`'s THEMATIC_BREAK. Same regex on purpose:
 * the pass that polices "one `---` per lesson, and it is the bridge" (AUTHORING.md §1)
 * and the pass that acts on it have to agree on what counts as a break.
 */
const THEMATIC_BREAK = /^ {0,3}-{3,}\s*$/;

/** The fence-tracking idiom of headings.ts / budget.ts / validate-structure.ts. */
const FENCE = /^\s*(`{3,}|~{3,})/;

const LECCION_TAG = /<Leccion\b/g;

/**
 * Add a `bridge` attribute to every `<Leccion>` below the lesson's thematic break.
 * No break (a draft, a fixture, a lesson still being written) → the source is returned
 * untouched, and every reference in it is treated as being outside the bridge.
 */
export function markBridgeReferences(source: string): string {
  const frontmatter = source.match(FRONTMATTER);
  const start = frontmatter ? (frontmatter[0].match(/\n/g) ?? []).length : 0;

  const lines = source.split("\n");

  let fence: string | null = null;
  let cut = -1;

  for (let i = start; i < lines.length; i += 1) {
    const opener = lines[i].match(FENCE);
    if (opener) {
      const marker = opener[1][0].repeat(3); // normalise ```` → ```
      if (fence === null) fence = marker;
      else if (marker === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;
    if (THEMATIC_BREAK.test(lines[i])) cut = i;
  }

  if (cut === -1) return source;

  fence = null;
  for (let i = cut + 1; i < lines.length; i += 1) {
    const opener = lines[i].match(FENCE);
    if (opener) {
      const marker = opener[1][0].repeat(3);
      if (fence === null) fence = marker;
      else if (marker === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;
    lines[i] = lines[i].replace(LECCION_TAG, "<Leccion bridge");
  }

  return lines.join("\n");
}
