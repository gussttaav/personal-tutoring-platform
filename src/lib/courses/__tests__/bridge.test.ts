/*
 * COURSE-P7-01 — Tests for the bridge pre-pass.
 *
 * `markBridgeReferences` decides, for every cross-reference in a lesson, whether the
 * component gets to render a link at all. It does that by finding one `---` in a string,
 * which sounds trivial and has two ways of being quietly wrong: the frontmatter's own
 * delimiters, and a `---` inside a fenced block. Either one silently turns a whole
 * lesson's forward references into plain text, with nothing to see in the diff.
 */

import { markBridgeReferences } from "../bridge";

const REF = '<Leccion slug="la-neurona">la neurona</Leccion>';
const MARKED = '<Leccion bridge slug="la-neurona">la neurona</Leccion>';

/** A lesson file: frontmatter, body, and (optionally) a well-formed bridge. */
function lesson(body: string, bridgeText?: string): string {
  const bridge = bridgeText === undefined ? "" : `\n\n---\n\n${bridgeText}`;
  return `---\nslug: demo\ntitle: "Demo"\n---\n\n${body}${bridge}\n`;
}

describe("markBridgeReferences", () => {
  it("flags the references below the break and leaves the ones above it alone", () => {
    const out = markBridgeReferences(lesson(`Arriba: ${REF}.`, `Abajo: ${REF}.`));

    expect(out).toContain(`Arriba: ${REF}.`);
    expect(out).toContain(`Abajo: ${MARKED}.`);
  });

  it("returns the source untouched when the lesson has no bridge", () => {
    const source = lesson(`Solo un párrafo con ${REF}.`);

    expect(markBridgeReferences(source)).toBe(source);
  });

  it("does not mistake the frontmatter delimiters for the bridge", () => {
    // The one that matters: `renderLesson` is handed the RAW file, frontmatter and all,
    // so "the last `---` in the string" is the frontmatter's closing delimiter whenever
    // the lesson has no bridge — which would flag the entire body.
    const source = lesson(`Un párrafo con ${REF}.`);

    expect(markBridgeReferences(source)).not.toContain("<Leccion bridge");
  });

  it("does not treat a `---` inside a fenced block as the bridge", () => {
    const body = ["```yaml", "slug: ejemplo", "---", "```", "", `Después: ${REF}.`].join("\n");

    expect(markBridgeReferences(lesson(body))).not.toContain("<Leccion bridge");
  });

  it("leaves a `<Leccion>` inside a fenced block below the bridge verbatim", () => {
    // A fenced sample below the break is code the reader SEES; injecting an attribute
    // into it would put `bridge` on the page.
    const out = markBridgeReferences(lesson("Cuerpo.", ["```mdx", REF, "```"].join("\n")));

    expect(out).toContain(REF);
    expect(out).not.toContain("<Leccion bridge");
  });

  it("takes the LAST break when a lesson wrongly has more than one", () => {
    // `validate-structure.ts` already warns about the second `---`; this only fixes what
    // happens meanwhile, which is that the bridge is the last one.
    const source = lesson(`Uno: ${REF}.\n\n---\n\nDos: ${REF}.`, `Tres: ${REF}.`);
    const out = markBridgeReferences(source);

    expect(out.match(/<Leccion bridge/g)).toHaveLength(1);
    expect(out).toContain(`Tres: ${MARKED}.`);
  });

  it("marks a self-closing reference too", () => {
    const out = markBridgeReferences(lesson("Cuerpo.", 'Cierre: <Leccion slug="x" />.'));

    expect(out).toContain('<Leccion bridge slug="x" />');
  });

  it("copes with a source that has no frontmatter at all", () => {
    const out = markBridgeReferences(`Arriba: ${REF}.\n\n---\n\nAbajo: ${REF}.\n`);

    expect(out).toContain(`Arriba: ${REF}.`);
    expect(out).toContain(`Abajo: ${MARKED}.`);
  });
});
